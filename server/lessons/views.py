import csv
from io import StringIO
import math
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from django.db.models import Q, Count
from django.http import HttpResponse
from django.utils import timezone
from datetime import timedelta
from statistics import NormalDist

from .models import (
    Lesson,
    Enrollment,
    Assignment,
    Submission,
    AssignmentAssignee,
    Reward,
    Experiment,
    ExperimentParticipant,
)
from .serializers import (
    LessonSerializer,
    EnrollmentSerializer,
    AssignmentSerializer,
    SubmissionSerializer,
    AssignmentAssigneeSerializer,
    RewardSerializer,
    ExperimentSerializer,
    ExperimentParticipantSerializer,
)
from users.models import LearningTrajectoryNode, User
from .adaptive import (
    build_teacher_analytics,
    get_student_personalization,
    recompute_student_profile,
)
from .assignment_content import build_assignment_description, normalize_assignment_type

try:
    from slide.models import SlideTemplate
except Exception:
    SlideTemplate = None


def is_teacher(user) -> bool:
    return getattr(user, "role", None) == "teacher"


def is_student(user) -> bool:
    return getattr(user, "role", None) == "student"


def _avg(values):
    filtered = [float(v) for v in values if v is not None]
    if not filtered:
        return None
    return sum(filtered) / len(filtered)


def _variance(values):
    cleaned = [float(v) for v in values if v is not None]
    n = len(cleaned)
    if n < 2:
        return None
    mean = sum(cleaned) / n
    return sum((x - mean) ** 2 for x in cleaned) / (n - 1)


def _stratum_from_score(score):
    if score is None:
        return "unknown"
    if score >= 70:
        return "high"
    if score >= 40:
        return "mid"
    return "low"


def _compare_improvements(control_values, experimental_values):
    control = [float(v) for v in control_values if v is not None]
    experimental = [float(v) for v in experimental_values if v is not None]
    if len(control) < 2 or len(experimental) < 2:
        return {
            "p_value_approx": None,
            "effect_size_cohens_d": None,
            "ci95_low": None,
            "ci95_high": None,
            "t_statistic": None,
            "is_statistically_significant": None,
            "method": "Welch t-test approximated with normal CDF",
        }

    mean_control = _avg(control)
    mean_experimental = _avg(experimental)
    if mean_control is None or mean_experimental is None:
        return {
            "p_value_approx": None,
            "effect_size_cohens_d": None,
            "ci95_low": None,
            "ci95_high": None,
            "t_statistic": None,
            "is_statistically_significant": None,
            "method": "Welch t-test approximated with normal CDF",
        }

    var_control = _variance(control) or 0.0
    var_experimental = _variance(experimental) or 0.0
    n1 = len(control)
    n2 = len(experimental)

    se = math.sqrt((var_control / n1) + (var_experimental / n2))
    if se <= 0:
        t_stat = 0.0
        p_value = 1.0
    else:
        t_stat = (mean_experimental - mean_control) / se
        normal = NormalDist()
        p_value = 2.0 * (1.0 - normal.cdf(abs(t_stat)))
        p_value = max(0.0, min(1.0, p_value))

    ci95_low = (mean_experimental - mean_control) - (1.96 * se)
    ci95_high = (mean_experimental - mean_control) + (1.96 * se)

    pooled_num = ((n1 - 1) * var_control) + ((n2 - 1) * var_experimental)
    pooled_den = max(n1 + n2 - 2, 1)
    pooled_sd = math.sqrt(pooled_num / pooled_den) if pooled_num > 0 else 0.0
    effect_size = ((mean_experimental - mean_control) / pooled_sd) if pooled_sd > 0 else None

    return {
        "p_value_approx": round(p_value, 6),
        "effect_size_cohens_d": round(effect_size, 4) if effect_size is not None else None,
        "ci95_low": round(ci95_low, 4),
        "ci95_high": round(ci95_high, 4),
        "t_statistic": round(t_stat, 4),
        "is_statistically_significant": p_value < 0.05,
        "method": "Welch t-test approximated with normal CDF",
    }


def _auto_window_score(experiment: Experiment, student_id: int, period: str):
    if not experiment.lesson_id:
        return None

    if period == "pre":
        start = experiment.pre_start
        end = experiment.pre_end
    else:
        start = experiment.post_start
        end = experiment.post_end

    if not start or not end:
        return None

    qs = Submission.objects.filter(
        assignment__lesson_id=experiment.lesson_id,
        student_id=student_id,
        submitted_at__date__gte=start,
        submitted_at__date__lte=end,
        score__isnull=False,
    )
    if not qs.exists():
        return None
    values = [float((s.score or 0.0) * 100.0) for s in qs]
    return _avg(values)


def _build_experiment_report(experiment: Experiment):
    participants = (
        ExperimentParticipant.objects.filter(experiment=experiment)
        .select_related("student")
        .order_by("group", "student__username")
    )
    rows = []
    buckets = {"control": [], "experimental": []}

    for participant in participants:
        pre_score = participant.pre_score
        post_score = participant.post_score
        source_pre = "manual" if pre_score is not None else "auto"
        source_post = "manual" if post_score is not None else "auto"
        if pre_score is None:
            pre_score = _auto_window_score(experiment, participant.student_id, "pre")
        if post_score is None:
            post_score = _auto_window_score(experiment, participant.student_id, "post")
        improvement = None
        if pre_score is not None and post_score is not None:
            improvement = float(post_score) - float(pre_score)

        row = {
            "participant_id": participant.id,
            "student_id": participant.student_id,
            "student_username": participant.student.username,
            "group": participant.group,
            "pre_score": round(pre_score, 2) if pre_score is not None else None,
            "post_score": round(post_score, 2) if post_score is not None else None,
            "improvement": round(improvement, 2) if improvement is not None else None,
            "pre_source": source_pre,
            "post_source": source_post,
            "pre_motivation": participant.pre_motivation,
            "post_motivation": participant.post_motivation,
            "motivation_delta": (
                round(float(participant.post_motivation) - float(participant.pre_motivation), 2)
                if participant.pre_motivation is not None and participant.post_motivation is not None
                else None
            ),
            "notes": participant.notes,
        }
        rows.append(row)
        buckets[participant.group].append(row)

    def summarize(group_rows):
        pre_values = [r["pre_score"] for r in group_rows if r["pre_score"] is not None]
        post_values = [r["post_score"] for r in group_rows if r["post_score"] is not None]
        improvements = [r["improvement"] for r in group_rows if r["improvement"] is not None]
        pre_mot = [r["pre_motivation"] for r in group_rows if r["pre_motivation"] is not None]
        post_mot = [r["post_motivation"] for r in group_rows if r["post_motivation"] is not None]

        avg_pre = _avg(pre_values)
        avg_post = _avg(post_values)
        avg_delta = _avg(improvements)
        improved_count = len([v for v in improvements if v > 0])

        return {
            "count": len(group_rows),
            "with_scores": len(improvements),
            "avg_pre_score": round(avg_pre, 2) if avg_pre is not None else None,
            "avg_post_score": round(avg_post, 2) if avg_post is not None else None,
            "avg_score_delta": round(avg_delta, 2) if avg_delta is not None else None,
            "improved_ratio": round((improved_count / len(improvements) * 100.0), 2) if improvements else None,
            "avg_pre_motivation": round(_avg(pre_mot), 2) if pre_mot else None,
            "avg_post_motivation": round(_avg(post_mot), 2) if post_mot else None,
            "avg_motivation_delta": (
                round((_avg(post_mot) - _avg(pre_mot)), 2)
                if pre_mot and post_mot and _avg(pre_mot) is not None and _avg(post_mot) is not None
                else None
            ),
        }

    control = summarize(buckets["control"])
    experimental = summarize(buckets["experimental"])
    control_improvements = [row["improvement"] for row in buckets["control"] if row["improvement"] is not None]
    experimental_improvements = [row["improvement"] for row in buckets["experimental"] if row["improvement"] is not None]
    did = None
    if control["avg_score_delta"] is not None and experimental["avg_score_delta"] is not None:
        did = experimental["avg_score_delta"] - control["avg_score_delta"]
    significance = _compare_improvements(control_improvements, experimental_improvements)

    if did is None:
        conclusion = "Дерек жеткіліксіз: pre/post score толық емес."
    elif did > 0:
        conclusion = "Эксперименттік топ оң нәтиже көрсетті (интерактивті, адаптивті модель тиімді)."
    elif did < 0:
        conclusion = "Бақылау тобының өсімі жоғары. Эксперимент дизайнын қайта калибрлеу керек."
    else:
        conclusion = "Екі топтың өсімі шамалас."

    return {
        "summary": {
            "focus_topic": experiment.focus_topic,
            "pre_window": {"start": experiment.pre_start, "end": experiment.pre_end},
            "post_window": {"start": experiment.post_start, "end": experiment.post_end},
            "participants_total": len(rows),
            "difference_in_differences": round(did, 2) if did is not None else None,
            "p_value_approx": significance.get("p_value_approx"),
            "effect_size_cohens_d": significance.get("effect_size_cohens_d"),
            "ci95_low": significance.get("ci95_low"),
            "ci95_high": significance.get("ci95_high"),
            "t_statistic": significance.get("t_statistic"),
            "is_statistically_significant": significance.get("is_statistically_significant"),
            "stat_method": significance.get("method"),
            "conclusion": conclusion,
        },
        "groups": {
            "control": control,
            "experimental": experimental,
        },
        "participants": rows,
    }


def _eligible_students_for_experiment(experiment: Experiment):
    if experiment.lesson_id:
        return User.objects.filter(
            role="student",
            lesson_submission__lesson_id=experiment.lesson_id,
        ).distinct()
    return User.objects.filter(
        role="student",
        lesson_submission__lesson__owner_id=experiment.teacher_id,
    ).distinct()


# ===================== LESSON =====================

class LessonViewSet(viewsets.ModelViewSet):
    serializer_class = LessonSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        if is_teacher(u):
            return Lesson.objects.filter(owner=u).order_by("-id")

        return Lesson.objects.filter(
            Q(enrollments__student=u) | Q(is_shared=True)
        ).distinct().order_by("-id")

    def perform_create(self, serializer):
        if not is_teacher(self.request.user):
            raise PermissionDenied("Only teachers can create lessons.")
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def share(self, request, pk=None):
        lesson = self.get_object()
        if lesson.owner_id != request.user.id:
            raise PermissionDenied("Only lesson owner can share.")
        lesson.is_shared = True
        lesson.save(update_fields=["is_shared", "share_code"])
        return Response(LessonSerializer(lesson).data)

    @action(detail=False, methods=["post"], url_path="join")
    def join_by_code(self, request):
        if not is_student(request.user):
            raise PermissionDenied("Only students can join.")
        code = request.data.get("code")
        if not code:
            return Response({"detail": "code required"}, status=400)
        lesson = Lesson.objects.filter(share_code=code, is_shared=True).first()
        if not lesson:
            return Response({"detail": "Lesson not found"}, status=404)
        Enrollment.objects.get_or_create(student=request.user, lesson=lesson)
        recompute_student_profile(request.user)
        return Response(LessonSerializer(lesson).data, status=201)

    @action(detail=True, methods=["post"], url_path="enroll")
    def enroll_student(self, request, pk=None):
        """Teacher adds a student to lesson by username/email/id."""
        if not is_teacher(request.user):
            raise PermissionDenied("Only teachers can enroll students.")
        lesson = self.get_object()
        if lesson.owner_id != request.user.id:
            raise PermissionDenied("Only lesson owner can enroll.")

        student_id = request.data.get("student_id")
        username = request.data.get("username")
        email = request.data.get("email")

        qs = User.objects.filter(role="student")
        student = None
        if student_id:
            student = qs.filter(id=student_id).first()
        elif username:
            student = qs.filter(username=username).first()
        elif email:
            student = qs.filter(email=email).first()
        else:
            return Response({"detail": "student_id or username or email required"}, status=400)

        if not student:
            return Response({"detail": "Student not found"}, status=404)

        enrollment, _ = Enrollment.objects.get_or_create(student=student, lesson=lesson)
        recompute_student_profile(student)
        return Response(EnrollmentSerializer(enrollment).data, status=201)


# ===================== ENROLLMENT =====================

class EnrollmentViewSet(viewsets.ModelViewSet):
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        if is_teacher(u):
            qs = Enrollment.objects.filter(lesson__owner=u).order_by("-id")
        else:
            qs = Enrollment.objects.filter(student=u).order_by("-id")
        lesson_id = self.request.query_params.get("lesson")
        if lesson_id:
            qs = qs.filter(lesson_id=lesson_id)
        return qs

    def perform_create(self, serializer):
        if not is_student(self.request.user):
            raise PermissionDenied("Only students can enroll.")
        serializer.save(student=self.request.user)


# ===================== ASSIGNMENT (TEACHER ONLY) =====================

class AssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        if not is_teacher(u):
            raise PermissionDenied("Students cannot access this endpoint.")
        return Assignment.objects.filter(
            lesson__owner=u
        ).order_by("-id")

    def perform_create(self, serializer):
        u = self.request.user
        if not is_teacher(u):
            raise PermissionDenied("Only teachers can create assignments.")

        lesson = serializer.validated_data["lesson"]
        if lesson.owner_id != u.id:
            raise PermissionDenied("Only your own lessons.")
        assignment_type_raw = serializer.validated_data.get("assignment_type", "quiz")
        content_id = serializer.validated_data.get("content_id")
        template_type = None
        if SlideTemplate and content_id:
            template_type = (
                SlideTemplate.objects.filter(id=content_id)
                .values_list("template_type", flat=True)
                .first()
            )

        assignment_type = normalize_assignment_type(assignment_type_raw, template_type)
        description = serializer.validated_data.get("description", "")
        if not str(description or "").strip():
            description = build_assignment_description(
                assignment_type=assignment_type,
                lesson_title=lesson.title,
                lesson_topic=lesson.topic,
            )

        serializer.save(
            assignment_type=assignment_type,
            description=description,
        )

    @action(detail=False, methods=["get"], url_path="mine")
    def my_assignments(self, request):
        u = request.user
        if not is_student(u):
            raise PermissionDenied("Only students can access this endpoint.")
        recompute_student_profile(u)
        lesson_id = request.query_params.get("lesson")
        include_locked_raw = str(request.query_params.get("include_locked", "")).strip().lower()
        include_locked = include_locked_raw in {"1", "true", "yes", "on"}
        unlocked_lessons = list(
            LearningTrajectoryNode.objects.filter(student=u)
            .exclude(status="locked")
            .values_list("lesson_id", flat=True)
        )
        qs = Assignment.objects.filter(
            Q(assignees__student=u) | Q(lesson__enrollments__student=u)
        ).distinct().order_by("-id")
        qs = qs.filter(is_published=True)
        if lesson_id:
            qs = qs.filter(lesson_id=lesson_id)
        if not include_locked:
            if unlocked_lessons:
                qs = qs.filter(lesson_id__in=unlocked_lessons)
            else:
                qs = qs.none()
        data = AssignmentSerializer(qs, many=True).data
        return Response(data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        """
        body: { "students": [1,2,3] }
        """
        assignment = self.get_object()
        students = request.data.get("students", [])

        created = []
        for sid in students:
            # ensure student enrolled in lesson
            ok = Enrollment.objects.filter(student_id=sid, lesson=assignment.lesson).exists()
            if not ok:
                continue
            obj, _ = AssignmentAssignee.objects.get_or_create(
                assignment=assignment,
                student_id=sid,
            )
            created.append(obj)

        return Response(
            AssignmentAssigneeSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )


# ===================== STUDENT TASK LIST =====================

class SubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = SubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        if is_teacher(u):
            qs = Submission.objects.filter(
                assignment__lesson__owner=u
            ).order_by("-id")
            assignment_id = self.request.query_params.get("assignment")
            if assignment_id:
                qs = qs.filter(assignment_id=assignment_id)
            return qs
        return Submission.objects.filter(student=u).order_by("-id")

    def perform_create(self, serializer):
        u = self.request.user
        if not is_student(u):
            raise PermissionDenied("Only students can submit.")

        assignment = serializer.validated_data["assignment"]

        # тек тағайындалған тапсырма болса ғана
        ok = AssignmentAssignee.objects.filter(
            assignment=assignment,
            student=u
        ).exists()

        if not ok:
            raise PermissionDenied("This assignment is not assigned to you.")

        serializer.save(student=u)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        if is_student(request.user):
            feedback = recompute_student_profile(request.user)
            if isinstance(response.data, dict):
                response.data["adaptive_feedback"] = feedback
        return response

    def update(self, request, *args, **kwargs):
        u = request.user
        if is_student(u):
            # students cannot set score/feedback
            if "score" in request.data or "feedback" in request.data:
                raise PermissionDenied("Students cannot set score/feedback.")
        response = super().update(request, *args, **kwargs)
        student = self.get_object().student
        if student and is_student(student):
            feedback = recompute_student_profile(student)
            if isinstance(response.data, dict):
                response.data["adaptive_feedback"] = feedback
        return response

    def partial_update(self, request, *args, **kwargs):
        u = request.user
        if is_student(u):
            if "score" in request.data or "feedback" in request.data:
                raise PermissionDenied("Students cannot set score/feedback.")
        response = super().partial_update(request, *args, **kwargs)
        student = self.get_object().student
        if student and is_student(student):
            feedback = recompute_student_profile(student)
            if isinstance(response.data, dict):
                response.data["adaptive_feedback"] = feedback
        return response


# ===================== REWARDS =====================

class RewardViewSet(viewsets.ModelViewSet):
    serializer_class = RewardSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        if is_teacher(u):
            return Reward.objects.filter(student__lesson_submission__lesson__owner=u).distinct()
        return Reward.objects.filter(student=u)

    def perform_create(self, serializer):
        u = self.request.user
        if not is_teacher(u):
            raise PermissionDenied("Only teachers can create rewards.")
        student_id = serializer.validated_data["student"].id
        # ensure student enrolled in any lesson of this teacher
        ok = Enrollment.objects.filter(student_id=student_id, lesson__owner=u).exists()
        if not ok:
            raise PermissionDenied("Student not in your lessons.")
        reward = serializer.save()
        recompute_student_profile(reward.student)

    @action(detail=False, methods=["get"], url_path="leaderboard")
    def leaderboard(self, request):
        u = request.user
        if is_teacher(u):
            qs = Reward.objects.filter(student__lesson_submission__lesson__owner=u).distinct()
        else:
            # students see leaderboard among their lessons
            qs = Reward.objects.filter(student__lesson_submission__student=u).distinct()
        data = (
            qs.values("student_id", "student__username")
            .annotate(count=Count("id"))
            .order_by("-count")[:10]
        )
        return Response(list(data))


class ExperimentViewSet(viewsets.ModelViewSet):
    serializer_class = ExperimentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if not is_teacher(self.request.user):
            raise PermissionDenied("Only teachers can access experiments.")
        return Experiment.objects.filter(teacher=self.request.user).select_related("lesson").order_by("-created_at")

    def perform_create(self, serializer):
        if not is_teacher(self.request.user):
            raise PermissionDenied("Only teachers can create experiments.")
        lesson = serializer.validated_data.get("lesson")
        if lesson and lesson.owner_id != self.request.user.id:
            raise PermissionDenied("Experiment lesson must belong to you.")
        serializer.save(teacher=self.request.user)

    @action(detail=True, methods=["post"], url_path="assign")
    def assign_students(self, request, pk=None):
        experiment = self.get_object()
        group = request.data.get("group")
        students = request.data.get("students") or []
        if group not in {"control", "experimental"}:
            return Response({"detail": "group must be control or experimental."}, status=400)
        if not isinstance(students, list) or not students:
            return Response({"detail": "students must be a non-empty array of student ids."}, status=400)

        created_ids = []
        for sid in students:
            student = User.objects.filter(id=sid, role="student").first()
            if not student:
                continue
            if experiment.lesson_id:
                enrolled = Enrollment.objects.filter(student_id=sid, lesson_id=experiment.lesson_id).exists()
                if not enrolled:
                    continue
            else:
                enrolled = Enrollment.objects.filter(student_id=sid, lesson__owner=request.user).exists()
                if not enrolled:
                    continue
            obj, _ = ExperimentParticipant.objects.update_or_create(
                experiment=experiment,
                student=student,
                defaults={"group": group},
            )
            created_ids.append(obj.id)

        participants = ExperimentParticipant.objects.filter(id__in=created_ids).select_related("student")
        return Response(ExperimentParticipantSerializer(participants, many=True).data, status=201)

    @action(detail=True, methods=["post"], url_path="auto-split")
    def auto_split(self, request, pk=None):
        experiment = self.get_object()
        reset_raw = request.data.get("reset_existing", True)
        if isinstance(reset_raw, str):
            reset_existing = reset_raw.strip().lower() in {"1", "true", "yes", "on"}
        else:
            reset_existing = bool(reset_raw)
        requested_students = request.data.get("students")

        eligible_qs = _eligible_students_for_experiment(experiment).order_by("username", "id")
        if isinstance(requested_students, list) and requested_students:
            eligible_qs = eligible_qs.filter(id__in=requested_students)

        eligible_students = list(eligible_qs)
        if not eligible_students:
            return Response(
                {"detail": "No eligible students found for this experiment."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_participants = ExperimentParticipant.objects.filter(experiment=experiment).select_related("student")
        existing_by_student = {item.student_id: item for item in existing_participants}

        if reset_existing:
            existing_participants.delete()

        strata = {"high": [], "mid": [], "low": [], "unknown": []}
        for student in eligible_students:
            existing = existing_by_student.get(student.id)
            baseline = existing.pre_score if existing and existing.pre_score is not None else None
            if baseline is None:
                baseline = _auto_window_score(experiment, student.id, "pre")
            stratum = _stratum_from_score(baseline)
            strata[stratum].append(
                {
                    "student": student,
                    "baseline": baseline,
                }
            )

        for key in strata.keys():
            if key == "unknown":
                strata[key].sort(key=lambda item: (item["student"].username, item["student"].id))
            else:
                strata[key].sort(
                    key=lambda item: (
                        -(item["baseline"] if item["baseline"] is not None else -1),
                        item["student"].username,
                        item["student"].id,
                    )
                )

        created_ids = []
        control_count = 0
        experimental_count = 0

        for stratum_name in ("high", "mid", "low", "unknown"):
            bucket = strata[stratum_name]
            if not bucket:
                continue
            first_group = "control" if control_count <= experimental_count else "experimental"
            second_group = "experimental" if first_group == "control" else "control"
            for idx, item in enumerate(bucket):
                student = item["student"]
                group = first_group if idx % 2 == 0 else second_group
                obj, _ = ExperimentParticipant.objects.update_or_create(
                    experiment=experiment,
                    student=student,
                    defaults={"group": group},
                )
                created_ids.append(obj.id)
                if group == "control":
                    control_count += 1
                else:
                    experimental_count += 1

        participants = (
            ExperimentParticipant.objects.filter(id__in=created_ids)
            .select_related("student")
            .order_by("group", "student__username")
        )
        stratum_distribution = {
            key: {
                "total": len(strata[key]),
                "with_baseline": len([item for item in strata[key] if item["baseline"] is not None]),
            }
            for key in ("high", "mid", "low", "unknown")
        }
        return Response(
            {
                "experiment_id": experiment.id,
                "total": len(created_ids),
                "control": control_count,
                "experimental": experimental_count,
                "strategy": "stratified_50_50_by_pre_score",
                "strata": stratum_distribution,
                "participants": ExperimentParticipantSerializer(participants, many=True).data,
            },
            status=200,
        )

    @action(detail=True, methods=["get"], url_path="report")
    def report(self, request, pk=None):
        experiment = self.get_object()
        payload = _build_experiment_report(experiment)
        payload["experiment"] = ExperimentSerializer(experiment).data
        return Response(payload)

    @action(detail=True, methods=["get"], url_path="export-csv")
    def export_csv(self, request, pk=None):
        experiment = self.get_object()
        payload = _build_experiment_report(experiment)

        stream = StringIO()
        writer = csv.writer(stream)

        writer.writerow(["Experiment", experiment.title])
        writer.writerow(["Focus Topic", experiment.focus_topic])
        writer.writerow(["Hypothesis", experiment.hypothesis])
        writer.writerow([])
        writer.writerow(
            [
                "Group",
                "Count",
                "With Scores",
                "Avg Pre Score",
                "Avg Post Score",
                "Avg Score Delta",
                "Improved Ratio %",
                "Avg Pre Motivation",
                "Avg Post Motivation",
                "Avg Motivation Delta",
            ]
        )

        for group_key in ("control", "experimental"):
            row = payload["groups"].get(group_key) or {}
            writer.writerow(
                [
                    group_key,
                    row.get("count"),
                    row.get("with_scores"),
                    row.get("avg_pre_score"),
                    row.get("avg_post_score"),
                    row.get("avg_score_delta"),
                    row.get("improved_ratio"),
                    row.get("avg_pre_motivation"),
                    row.get("avg_post_motivation"),
                    row.get("avg_motivation_delta"),
                ]
            )

        writer.writerow([])
        writer.writerow(["Difference in differences", payload["summary"].get("difference_in_differences")])
        writer.writerow(["P-value (approx)", payload["summary"].get("p_value_approx")])
        writer.writerow(["Effect size (Cohen's d)", payload["summary"].get("effect_size_cohens_d")])
        writer.writerow(["95% CI low", payload["summary"].get("ci95_low")])
        writer.writerow(["95% CI high", payload["summary"].get("ci95_high")])
        writer.writerow(["Statistically significant (p<0.05)", payload["summary"].get("is_statistically_significant")])
        writer.writerow(["Stat method", payload["summary"].get("stat_method")])
        writer.writerow(["Conclusion", payload["summary"].get("conclusion")])
        writer.writerow([])
        writer.writerow(
            [
                "Participant ID",
                "Student ID",
                "Student Username",
                "Group",
                "Pre Score",
                "Post Score",
                "Improvement",
                "Pre Source",
                "Post Source",
                "Pre Motivation",
                "Post Motivation",
                "Motivation Delta",
                "Notes",
            ]
        )
        for participant in payload.get("participants", []):
            writer.writerow(
                [
                    participant.get("participant_id"),
                    participant.get("student_id"),
                    participant.get("student_username"),
                    participant.get("group"),
                    participant.get("pre_score"),
                    participant.get("post_score"),
                    participant.get("improvement"),
                    participant.get("pre_source"),
                    participant.get("post_source"),
                    participant.get("pre_motivation"),
                    participant.get("post_motivation"),
                    participant.get("motivation_delta"),
                    participant.get("notes"),
                ]
            )

        response = HttpResponse(stream.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="experiment_{experiment.id}_report.csv"'
        return response

    @action(detail=False, methods=["post"], url_path="sample-db")
    def create_db_sample(self, request):
        if not is_teacher(request.user):
            raise PermissionDenied("Only teachers can create experiments.")

        lesson_id = request.data.get("lesson_id")
        lesson = None
        if lesson_id:
            lesson = Lesson.objects.filter(id=lesson_id, owner=request.user).first()
            if not lesson:
                return Response({"detail": "Lesson not found or not yours."}, status=404)

        today = timezone.localdate()
        experiment = Experiment.objects.create(
            teacher=request.user,
            lesson=lesson,
            title=request.data.get("title") or "База данных: бақылау және эксперименттік топ",
            focus_topic=request.data.get("focus_topic") or "База данных",
            hypothesis=request.data.get("hypothesis")
            or (
                "База данных тақырыбында интерактивті және адаптивті орта қолданылған "
                "эксперименттік топтың нәтижесі бақылау тобына қарағанда жоғары болады."
            ),
            pre_start=today - timedelta(days=14),
            pre_end=today - timedelta(days=8),
            post_start=today - timedelta(days=7),
            post_end=today,
            notes=request.data.get("notes") or "Pre/Post салыстыру диссертациялық эксперимент үшін.",
        )
        return Response(ExperimentSerializer(experiment).data, status=201)


class ExperimentParticipantViewSet(viewsets.ModelViewSet):
    serializer_class = ExperimentParticipantSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if not is_teacher(self.request.user):
            raise PermissionDenied("Only teachers can access experiment participants.")
        qs = ExperimentParticipant.objects.filter(
            experiment__teacher=self.request.user
        ).select_related("student", "experiment")
        experiment_id = self.request.query_params.get("experiment")
        if experiment_id:
            qs = qs.filter(experiment_id=experiment_id)
        return qs.order_by("group", "student__username")

    def perform_create(self, serializer):
        if not is_teacher(self.request.user):
            raise PermissionDenied("Only teachers can add participants.")
        experiment = serializer.validated_data["experiment"]
        student = serializer.validated_data["student"]
        if experiment.teacher_id != self.request.user.id:
            raise PermissionDenied("Experiment does not belong to you.")
        if getattr(student, "role", None) != "student":
            raise PermissionDenied("Only student accounts can be participants.")
        if experiment.lesson_id:
            enrolled = Enrollment.objects.filter(student=student, lesson_id=experiment.lesson_id).exists()
            if not enrolled:
                raise PermissionDenied("Student is not enrolled in experiment lesson.")
        serializer.save()


class InsightViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"], url_path="student")
    def student(self, request):
        if not is_student(request.user):
            raise PermissionDenied("Only students can access student insights.")
        refresh = str(request.query_params.get("refresh", "")).lower() in {"1", "true", "yes"}
        payload = get_student_personalization(request.user, refresh=refresh)
        return Response(payload or {})

    @action(detail=False, methods=["post"], url_path="refresh")
    def refresh(self, request):
        user = request.user
        target = user
        if is_teacher(user):
            student_id = request.data.get("student_id")
            if not student_id:
                return Response({"detail": "student_id is required for teacher refresh."}, status=400)
            student = User.objects.filter(id=student_id, role="student").first()
            if not student:
                return Response({"detail": "Student not found."}, status=404)
            allowed = Enrollment.objects.filter(student=student, lesson__owner=user).exists()
            if not allowed:
                raise PermissionDenied("Student is not in your lessons.")
            target = student
        elif not is_student(user):
            raise PermissionDenied("Unsupported role for refresh.")

        payload = recompute_student_profile(target)
        return Response(payload or {})

    @action(detail=False, methods=["get"], url_path="teacher")
    def teacher(self, request):
        if not is_teacher(request.user):
            raise PermissionDenied("Only teachers can access teacher insights.")

        lesson_id = request.query_params.get("lesson")
        student_id = request.query_params.get("student")

        try:
            lesson_val = int(lesson_id) if lesson_id else None
        except ValueError:
            return Response({"detail": "Invalid lesson query param."}, status=400)

        try:
            student_val = int(student_id) if student_id else None
        except ValueError:
            return Response({"detail": "Invalid student query param."}, status=400)

        payload = build_teacher_analytics(
            teacher=request.user,
            lesson_id=lesson_val,
            student_id=student_val,
        )
        return Response(payload)
