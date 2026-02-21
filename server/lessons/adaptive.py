from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

from django.utils import timezone

from lessons.models import Assignment, Enrollment, Reward, Submission as LessonSubmission
from slide.models import Submission as SlideSubmission
from users.models import AdaptiveRule, LearningTrajectoryNode, StudentProfile, User


@dataclass
class RuleLike:
    min_success_rate: float
    max_success_rate: float
    min_attempts: int
    action: str
    recommendation_template: str


def _topic_from_lesson_title(topic: str, title: str) -> str:
    topic = (topic or "").strip()
    if topic:
        return topic
    return (title or "General").strip()


def _safe_int(value: Any) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return 0
    return max(parsed, 0)


def _safe_score(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        score = float(value)
    except (TypeError, ValueError):
        return None
    return max(0.0, min(score, 1.0))


def _active_rules() -> List[RuleLike]:
    db_rules = list(AdaptiveRule.objects.filter(is_active=True).order_by("min_success_rate", "id"))
    if db_rules:
        return [
            RuleLike(
                min_success_rate=r.min_success_rate,
                max_success_rate=r.max_success_rate,
                min_attempts=r.min_attempts,
                action=r.action,
                recommendation_template=r.recommendation_template,
            )
            for r in db_rules
        ]

    return [
        RuleLike(
            min_success_rate=0.0,
            max_success_rate=0.55,
            min_attempts=1,
            action="decrease_difficulty",
            recommendation_template="Базалық деңгейдегі тапсырмаларды қайталаңыз.",
        ),
        RuleLike(
            min_success_rate=0.55,
            max_success_rate=0.8,
            min_attempts=2,
            action="reinforce_topic",
            recommendation_template="Әлсіз тақырыптарға қосымша жаттығу берілді.",
        ),
        RuleLike(
            min_success_rate=0.8,
            max_success_rate=1.01,
            min_attempts=2,
            action="increase_difficulty",
            recommendation_template="Күрделірек тапсырмаға көшуге дайынсыз.",
        ),
    ]


def _pick_rule(overall_score: float, attempts: int) -> RuleLike:
    rules = _active_rules()
    matching_by_score = [
        rule
        for rule in rules
        if rule.min_success_rate <= overall_score < rule.max_success_rate
    ]
    if matching_by_score:
        for rule in matching_by_score:
            if attempts >= rule.min_attempts:
                return rule
        return matching_by_score[0]

    for rule in rules:
        if attempts >= rule.min_attempts and rule.min_success_rate <= overall_score < rule.max_success_rate:
            return rule
    return rules[0]


def _learning_level(average_score: float) -> str:
    if average_score >= 0.8:
        return "advanced"
    if average_score >= 0.55:
        return "intermediate"
    return "beginner"


def _collect_student_entries(student: User) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    assignment_by_template: Dict[int, Assignment] = {}

    enrolled_assignments = (
        Assignment.objects.filter(lesson__enrollments__student=student)
        .select_related("lesson")
        .order_by("id")
    )
    for assignment in enrolled_assignments:
        if assignment.content_id and assignment.content_id not in assignment_by_template:
            assignment_by_template[assignment.content_id] = assignment

    lesson_submissions = (
        LessonSubmission.objects.filter(student=student)
        .select_related("assignment__lesson")
        .order_by("submitted_at", "id")
    )
    for submission in lesson_submissions:
        assignment = submission.assignment
        lesson = assignment.lesson
        entries.append(
            {
                "student_id": student.id,
                "student_username": student.username,
                "topic": _topic_from_lesson_title(lesson.topic, lesson.title),
                "score": _safe_score(submission.score),
                "duration_seconds": _safe_int(submission.duration_seconds),
                "created_at": submission.submitted_at,
                "source": "assignment_submission",
            }
        )

    slide_submissions = (
        SlideSubmission.objects.filter(user=student)
        .select_related("template", "slide__lesson")
        .order_by("created_at", "id")
    )
    for submission in slide_submissions:
        topic = "General"
        if submission.template_id and submission.template_id in assignment_by_template:
            assignment = assignment_by_template[submission.template_id]
            topic = _topic_from_lesson_title(assignment.lesson.topic, assignment.lesson.title)
        elif submission.slide_id and submission.slide and submission.slide.lesson_id:
            lesson = submission.slide.lesson
            topic = _topic_from_lesson_title(lesson.topic, lesson.title)
        elif submission.template:
            topic = submission.template.title

        payload = submission.data if isinstance(submission.data, dict) else {}
        entries.append(
            {
                "student_id": student.id,
                "student_username": student.username,
                "topic": topic,
                "score": _safe_score(submission.score),
                "duration_seconds": _safe_int(submission.duration_seconds or payload.get("duration_seconds")),
                "created_at": submission.created_at,
                "source": "interactive_submission",
            }
        )

    entries.sort(key=lambda item: (item.get("created_at") or timezone.now(), item.get("source", "")))
    return entries


def _topic_metrics(entries: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    buckets: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {
            "attempts": 0,
            "scored_attempts": 0,
            "score_sum": 0.0,
            "avg_score": 0.0,
            "total_time_seconds": 0,
        }
    )
    for entry in entries:
        topic = entry["topic"]
        metric = buckets[topic]
        metric["attempts"] += 1
        metric["total_time_seconds"] += _safe_int(entry.get("duration_seconds"))
        score = entry.get("score")
        if score is not None:
            metric["scored_attempts"] += 1
            metric["score_sum"] += float(score)

    for metric in buckets.values():
        if metric["scored_attempts"]:
            metric["avg_score"] = metric["score_sum"] / metric["scored_attempts"]
    return buckets


def sync_learning_trajectory(student: User, topic_stats: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    enrollments = (
        Enrollment.objects.filter(student=student)
        .select_related("lesson")
        .order_by("joined_at", "lesson_id")
    )
    lesson_ids = [en.lesson_id for en in enrollments]
    LearningTrajectoryNode.objects.filter(student=student).exclude(lesson_id__in=lesson_ids).delete()

    now = timezone.now()
    prev_completed = True
    completed = 0
    total = 0
    serialized_nodes: List[Dict[str, Any]] = []

    for idx, enrollment in enumerate(enrollments, start=1):
        lesson = enrollment.lesson
        topic = _topic_from_lesson_title(lesson.topic, lesson.title)
        metric = topic_stats.get(topic, {})
        attempts = int(metric.get("attempts", 0))
        mastery = float(metric.get("avg_score", 0.0))

        node, _ = LearningTrajectoryNode.objects.get_or_create(
            student=student,
            lesson=lesson,
            defaults={
                "topic": topic,
                "order_index": idx,
                "status": "unlocked" if idx == 1 else "locked",
            },
        )
        node.topic = topic
        node.order_index = idx
        node.mastery = mastery

        can_access = idx == 1 or prev_completed
        is_completed = attempts > 0 and mastery >= node.required_score
        if is_completed:
            node.status = "completed"
            if node.completed_at is None:
                node.completed_at = now
        else:
            node.completed_at = None
            if not can_access:
                node.status = "locked"
            elif attempts == 0:
                node.status = "unlocked"
            elif mastery < 0.5:
                node.status = "review"
            else:
                node.status = "in_progress"

        if node.status in {"unlocked", "in_progress", "review", "completed"} and node.unlocked_at is None:
            node.unlocked_at = now

        if node.status == "locked":
            node.recommendation = "Алдыңғы модульді аяқтағанда бұл тақырып ашылады."
        elif node.status == "review":
            node.recommendation = "Қайта қарау қажет: жеңіл тапсырмадан бастаңыз."
        elif node.status == "in_progress":
            node.recommendation = "Прогрессті арттыру үшін қосымша тапсырма орындаңыз."
        elif node.status == "completed":
            node.recommendation = "Модуль сәтті аяқталды."
        else:
            node.recommendation = "Модуль ашық, орындауды бастауға болады."

        node.save(
            update_fields=[
                "topic",
                "order_index",
                "mastery",
                "status",
                "recommendation",
                "unlocked_at",
                "completed_at",
                "updated_at",
            ]
        )

        total += 1
        if node.status == "completed":
            completed += 1
        prev_completed = node.status == "completed"

        serialized_nodes.append(
            {
                "id": node.id,
                "lesson": lesson.id,
                "lesson_title": lesson.title,
                "topic": node.topic,
                "order_index": node.order_index,
                "required_score": node.required_score,
                "mastery": round(node.mastery, 4),
                "status": node.status,
                "recommendation": node.recommendation,
                "unlocked_at": node.unlocked_at,
                "completed_at": node.completed_at,
            }
        )

    completion_rate = (completed / total * 100.0) if total else 0.0
    return {
        "nodes": serialized_nodes,
        "completion_rate": completion_rate,
    }


def recompute_student_profile(student: User) -> Optional[Dict[str, Any]]:
    if getattr(student, "role", None) != "student":
        return None

    profile, _ = StudentProfile.objects.get_or_create(student=student)
    entries = _collect_student_entries(student)
    stats = _topic_metrics(entries)

    scored_entries = [entry for entry in entries if entry.get("score") is not None]
    scored_attempts = len(scored_entries)
    score_sum = sum(float(entry["score"]) for entry in scored_entries)
    average_score = (score_sum / scored_attempts) if scored_attempts else 0.0
    total_time_seconds = sum(_safe_int(entry.get("duration_seconds")) for entry in entries)

    weak_topics = sorted(
        [
            {"topic": topic, "avg_score": round(values["avg_score"], 4), "attempts": values["attempts"]}
            for topic, values in stats.items()
            if values["attempts"] >= 2 and values["avg_score"] < 0.6
        ],
        key=lambda item: (item["avg_score"], -item["attempts"]),
    )
    strong_topics = sorted(
        [
            {"topic": topic, "avg_score": round(values["avg_score"], 4), "attempts": values["attempts"]}
            for topic, values in stats.items()
            if values["attempts"] >= 2 and values["avg_score"] >= 0.8
        ],
        key=lambda item: (-item["avg_score"], -item["attempts"]),
    )

    trajectory = sync_learning_trajectory(student, stats)
    nodes = trajectory["nodes"]
    completion_rate = float(trajectory["completion_rate"])

    rule = _pick_rule(average_score, scored_attempts)
    first_locked = next((n for n in nodes if n["status"] == "locked"), None)

    recommendation = rule.recommendation_template
    if weak_topics:
        recommendation = (
            f"{weak_topics[0]['topic']} тақырыбын қайталау ұсынылады. "
            f"{rule.recommendation_template}".strip()
        )
    elif first_locked and rule.action == "increase_difficulty":
        recommendation = (
            f"Келесі модульге көшуге болады: {first_locked['topic']}."
        )

    progress_history = []
    for entry in scored_entries[-30:]:
        created_at = entry.get("created_at")
        if created_at is None:
            continue
        progress_history.append(
            {
                "date": created_at.date().isoformat(),
                "topic": entry.get("topic", "General"),
                "score": round(float(entry["score"]) * 100.0, 2),
            }
        )

    reward_points = Reward.objects.filter(student=student).count() * 25
    base_points = int(sum(max(float(entry["score"]), 0.0) * 100.0 for entry in scored_entries))

    profile.learning_level = _learning_level(average_score)
    profile.average_score = average_score
    profile.completion_rate = completion_rate
    profile.total_points = reward_points + base_points
    profile.total_time_seconds = total_time_seconds
    profile.weak_topics = weak_topics
    profile.strong_topics = strong_topics
    profile.progress_history = progress_history
    profile.last_recommendation = recommendation.strip()
    profile.save(
        update_fields=[
            "learning_level",
            "average_score",
            "completion_rate",
            "total_points",
            "total_time_seconds",
            "weak_topics",
            "strong_topics",
            "progress_history",
            "last_recommendation",
            "updated_at",
        ]
    )

    return {
        "profile_id": profile.id,
        "learning_level": profile.learning_level,
        "average_score": round(profile.average_score * 100.0, 2),
        "completion_rate": round(profile.completion_rate, 2),
        "total_points": profile.total_points,
        "total_time_seconds": profile.total_time_seconds,
        "weak_topics": profile.weak_topics,
        "strong_topics": profile.strong_topics,
        "progress_history": profile.progress_history,
        "recommendation": profile.last_recommendation,
        "trajectory": nodes,
        "adaptive_action": rule.action,
    }


def get_student_personalization(student: User, refresh: bool = False) -> Optional[Dict[str, Any]]:
    if getattr(student, "role", None) != "student":
        return None
    if refresh or not hasattr(student, "student_profile"):
        return recompute_student_profile(student)
    profile = student.student_profile
    nodes = list(
        LearningTrajectoryNode.objects.filter(student=student)
        .select_related("lesson")
        .order_by("order_index", "id")
    )
    return {
        "profile_id": profile.id,
        "learning_level": profile.learning_level,
        "average_score": round(profile.average_score * 100.0, 2),
        "completion_rate": round(profile.completion_rate, 2),
        "total_points": profile.total_points,
        "total_time_seconds": profile.total_time_seconds,
        "weak_topics": profile.weak_topics,
        "strong_topics": profile.strong_topics,
        "progress_history": profile.progress_history,
        "recommendation": profile.last_recommendation,
        "trajectory": [
            {
                "id": node.id,
                "lesson": node.lesson_id,
                "lesson_title": node.lesson.title,
                "topic": node.topic,
                "order_index": node.order_index,
                "required_score": node.required_score,
                "mastery": round(node.mastery, 4),
                "status": node.status,
                "recommendation": node.recommendation,
                "unlocked_at": node.unlocked_at,
                "completed_at": node.completed_at,
            }
            for node in nodes
        ],
    }


def _entries_for_teacher(
    teacher: User,
    lesson_id: Optional[int] = None,
    student_id: Optional[int] = None,
) -> Dict[str, Any]:
    assignments = Assignment.objects.filter(lesson__owner=teacher).select_related("lesson")
    if lesson_id:
        assignments = assignments.filter(lesson_id=lesson_id)

    enrollments = Enrollment.objects.filter(lesson__owner=teacher).select_related("student", "lesson")
    if lesson_id:
        enrollments = enrollments.filter(lesson_id=lesson_id)
    if student_id:
        enrollments = enrollments.filter(student_id=student_id)

    students = {enrollment.student_id: enrollment.student for enrollment in enrollments}
    student_ids = list(students.keys())
    if not student_ids:
        return {"entries": [], "students": {}, "student_ids": []}

    assignment_by_template: Dict[int, Assignment] = {}
    assignment_list = list(assignments)
    for assignment in assignment_list:
        if assignment.content_id and assignment.content_id not in assignment_by_template:
            assignment_by_template[assignment.content_id] = assignment

    entries: List[Dict[str, Any]] = []

    lesson_submissions = (
        LessonSubmission.objects.filter(assignment__in=assignment_list, student_id__in=student_ids)
        .select_related("assignment__lesson", "student")
        .order_by("submitted_at", "id")
    )
    for submission in lesson_submissions:
        topic = _topic_from_lesson_title(submission.assignment.lesson.topic, submission.assignment.lesson.title)
        entries.append(
            {
                "student_id": submission.student_id,
                "student_username": submission.student.username,
                "topic": topic,
                "score": _safe_score(submission.score),
                "duration_seconds": _safe_int(submission.duration_seconds),
                "created_at": submission.submitted_at,
                "source": "assignment_submission",
            }
        )

    template_ids = [template_id for template_id in assignment_by_template.keys()]
    if template_ids:
        slide_submissions = (
            SlideSubmission.objects.filter(user_id__in=student_ids, template_id__in=template_ids)
            .select_related("template", "user")
            .order_by("created_at", "id")
        )
        for submission in slide_submissions:
            topic = "General"
            assignment = assignment_by_template.get(submission.template_id)
            if assignment:
                topic = _topic_from_lesson_title(assignment.lesson.topic, assignment.lesson.title)
            elif submission.template:
                topic = submission.template.title
            payload = submission.data if isinstance(submission.data, dict) else {}
            entries.append(
                {
                    "student_id": submission.user_id,
                    "student_username": submission.user.username if submission.user else f"student-{submission.user_id}",
                    "topic": topic,
                    "score": _safe_score(submission.score),
                    "duration_seconds": _safe_int(submission.duration_seconds or payload.get("duration_seconds")),
                    "created_at": submission.created_at,
                    "source": "interactive_submission",
                }
            )

    return {
        "entries": entries,
        "students": students,
        "student_ids": student_ids,
    }


def build_teacher_analytics(
    teacher: User,
    lesson_id: Optional[int] = None,
    student_id: Optional[int] = None,
) -> Dict[str, Any]:
    collected = _entries_for_teacher(teacher=teacher, lesson_id=lesson_id, student_id=student_id)
    entries = collected["entries"]
    students: Dict[int, User] = collected["students"]
    student_ids: List[int] = collected["student_ids"]

    per_student: Dict[int, Dict[str, Any]] = {
        sid: {
            "student_id": sid,
            "username": students[sid].username,
            "attempts": 0,
            "scored_attempts": 0,
            "score_sum": 0.0,
            "avg_score": 0.0,
            "total_time_seconds": 0,
            "topics": defaultdict(int),
        }
        for sid in student_ids
    }
    topic_stats: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"attempts": 0, "scored_attempts": 0, "score_sum": 0.0, "avg_score": 0.0}
    )
    progress_by_day: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"attempts": 0, "scored_attempts": 0, "score_sum": 0.0}
    )

    total_scored = 0
    total_score_sum = 0.0

    for entry in entries:
        sid = entry["student_id"]
        topic = entry["topic"]
        score = entry.get("score")
        duration = _safe_int(entry.get("duration_seconds"))
        created_at = entry.get("created_at")
        day_key = created_at.date().isoformat() if created_at else None

        student_row = per_student[sid]
        student_row["attempts"] += 1
        student_row["total_time_seconds"] += duration
        student_row["topics"][topic] += 1

        topic_stats[topic]["attempts"] += 1
        if day_key:
            progress_by_day[day_key]["attempts"] += 1

        if score is not None:
            student_row["scored_attempts"] += 1
            student_row["score_sum"] += float(score)

            topic_stats[topic]["scored_attempts"] += 1
            topic_stats[topic]["score_sum"] += float(score)

            total_scored += 1
            total_score_sum += float(score)

            if day_key:
                progress_by_day[day_key]["scored_attempts"] += 1
                progress_by_day[day_key]["score_sum"] += float(score)

    for row in per_student.values():
        if row["scored_attempts"]:
            row["avg_score"] = row["score_sum"] / row["scored_attempts"]

    for metric in topic_stats.values():
        if metric["scored_attempts"]:
            metric["avg_score"] = metric["score_sum"] / metric["scored_attempts"]

    profile_by_student = {
        profile.student_id: profile
        for profile in StudentProfile.objects.filter(student_id__in=student_ids)
    }
    for sid in student_ids:
        if sid not in profile_by_student:
            recompute_student_profile(students[sid])
    profile_by_student = {
        profile.student_id: profile
        for profile in StudentProfile.objects.filter(student_id__in=student_ids)
    }

    students_result = []
    for sid, row in per_student.items():
        profile = profile_by_student.get(sid)
        students_result.append(
            {
                "student_id": sid,
                "username": row["username"],
                "attempts": row["attempts"],
                "scored_attempts": row["scored_attempts"],
                "average_score": round(row["avg_score"] * 100.0, 2),
                "total_time_seconds": row["total_time_seconds"],
                "learning_level": profile.learning_level if profile else None,
                "weak_topics": profile.weak_topics if profile else [],
                "completion_rate": round(profile.completion_rate, 2) if profile else 0.0,
            }
        )
    students_result.sort(key=lambda item: (-item["average_score"], -item["attempts"], item["username"]))

    hardest_topics = []
    for topic, metric in topic_stats.items():
        if not metric["scored_attempts"]:
            continue
        hardest_topics.append(
            {
                "topic": topic,
                "attempts": metric["attempts"],
                "average_score": round(metric["avg_score"] * 100.0, 2),
            }
        )
    hardest_topics.sort(key=lambda item: (item["average_score"], -item["attempts"]))

    progress = []
    for day, metric in sorted(progress_by_day.items()):
        avg = (metric["score_sum"] / metric["scored_attempts"] * 100.0) if metric["scored_attempts"] else 0.0
        progress.append(
            {
                "date": day,
                "attempts": metric["attempts"],
                "average_score": round(avg, 2),
            }
        )

    total_time = sum(row["total_time_seconds"] for row in per_student.values())
    group_average = (total_score_sum / total_scored * 100.0) if total_scored else 0.0

    payload = {
        "summary": {
            "students_count": len(student_ids),
            "attempts_count": len(entries),
            "scored_attempts": total_scored,
            "group_average_score": round(group_average, 2),
            "total_time_seconds": total_time,
        },
        "hardest_topics": hardest_topics[:8],
        "progress_by_day": progress[-30:],
        "students": students_result,
    }

    if student_id and student_id in student_ids:
        profile = profile_by_student.get(student_id)
        payload["individual"] = {
            "student_id": student_id,
            "profile": {
                "learning_level": profile.learning_level if profile else None,
                "average_score": round((profile.average_score if profile else 0.0) * 100.0, 2),
                "completion_rate": round(profile.completion_rate, 2) if profile else 0.0,
                "weak_topics": profile.weak_topics if profile else [],
                "strong_topics": profile.strong_topics if profile else [],
                "recommendation": profile.last_recommendation if profile else "",
                "progress_history": profile.progress_history if profile else [],
            },
            "trajectory": [
                {
                    "lesson": node.lesson_id,
                    "lesson_title": node.lesson.title,
                    "topic": node.topic,
                    "status": node.status,
                    "mastery": round(node.mastery * 100.0, 2),
                    "required_score": round(node.required_score * 100.0, 2),
                    "recommendation": node.recommendation,
                }
                for node in LearningTrajectoryNode.objects.filter(student_id=student_id)
                .select_related("lesson")
                .order_by("order_index", "id")
            ],
        }

    return payload
