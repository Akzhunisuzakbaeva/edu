from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from lessons.models import Assignment, Enrollment, Experiment, ExperimentParticipant, Lesson, Submission
from slide.models import SlideTemplate


User = get_user_model()


class ExperimentAnalyticsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.teacher = User.objects.create_user(username="teacher_exp", password="pass1234", role="teacher")
        self.student_a = User.objects.create_user(username="student_a", password="pass1234", role="student")
        self.student_b = User.objects.create_user(username="student_b", password="pass1234", role="student")
        self.student_c = User.objects.create_user(username="student_c", password="pass1234", role="student")
        self.student_d = User.objects.create_user(username="student_d", password="pass1234", role="student")

        self.lesson = Lesson.objects.create(
            owner=self.teacher,
            title="База данных негіздері",
            topic="База данных",
        )
        for student in (self.student_a, self.student_b, self.student_c, self.student_d):
            Enrollment.objects.create(student=student, lesson=self.lesson)

        self.assignment = Assignment.objects.create(
            lesson=self.lesson,
            title="DB pretest",
            assignment_type="quiz",
            is_published=True,
        )

        # Pre scores for stratification: high/high/low/low
        Submission.objects.create(assignment=self.assignment, student=self.student_a, score=0.90)
        Submission.objects.create(assignment=self.assignment, student=self.student_b, score=0.82)
        Submission.objects.create(assignment=self.assignment, student=self.student_c, score=0.20)
        Submission.objects.create(assignment=self.assignment, student=self.student_d, score=0.10)

        today = timezone.localdate()
        self.experiment = Experiment.objects.create(
            teacher=self.teacher,
            lesson=self.lesson,
            title="DB experiment",
            focus_topic="База данных",
            pre_start=today - timedelta(days=1),
            pre_end=today + timedelta(days=1),
            post_start=today - timedelta(days=1),
            post_end=today + timedelta(days=1),
        )

    def test_auto_split_is_stratified_and_balanced(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.post(f"/api/lessons/experiments/{self.experiment.id}/auto-split/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["strategy"], "stratified_50_50_by_pre_score")
        self.assertEqual(response.data["control"], 2)
        self.assertEqual(response.data["experimental"], 2)
        self.assertEqual(response.data["strata"]["high"]["total"], 2)
        self.assertEqual(response.data["strata"]["low"]["total"], 2)

        control_users = set(
            ExperimentParticipant.objects.filter(experiment=self.experiment, group="control")
            .values_list("student__username", flat=True)
        )
        experimental_users = set(
            ExperimentParticipant.objects.filter(experiment=self.experiment, group="experimental")
            .values_list("student__username", flat=True)
        )

        high_students = {"student_a", "student_b"}
        low_students = {"student_c", "student_d"}

        self.assertEqual(len(control_users & high_students), 1)
        self.assertEqual(len(experimental_users & high_students), 1)
        self.assertEqual(len(control_users & low_students), 1)
        self.assertEqual(len(experimental_users & low_students), 1)

    def test_experiment_report_contains_statistical_block(self):
        self.client.force_authenticate(self.teacher)

        ExperimentParticipant.objects.create(
            experiment=self.experiment,
            student=self.student_a,
            group="control",
            pre_score=50,
            post_score=55,
            pre_motivation=5.0,
            post_motivation=5.5,
        )
        ExperimentParticipant.objects.create(
            experiment=self.experiment,
            student=self.student_b,
            group="control",
            pre_score=52,
            post_score=56,
            pre_motivation=5.2,
            post_motivation=5.4,
        )
        ExperimentParticipant.objects.create(
            experiment=self.experiment,
            student=self.student_c,
            group="experimental",
            pre_score=50,
            post_score=70,
            pre_motivation=5.1,
            post_motivation=7.1,
        )
        ExperimentParticipant.objects.create(
            experiment=self.experiment,
            student=self.student_d,
            group="experimental",
            pre_score=48,
            post_score=66,
            pre_motivation=4.9,
            post_motivation=6.7,
        )

        response = self.client.get(f"/api/lessons/experiments/{self.experiment.id}/report/")
        self.assertEqual(response.status_code, 200)

        summary = response.data["summary"]
        self.assertAlmostEqual(summary["difference_in_differences"], 14.5, places=1)
        self.assertIsNotNone(summary["p_value_approx"])
        self.assertIsNotNone(summary["effect_size_cohens_d"])
        self.assertIn("stat_method", summary)
        self.assertIn("ci95_low", summary)
        self.assertIn("ci95_high", summary)

    def test_experiment_export_csv_contains_stat_fields(self):
        self.client.force_authenticate(self.teacher)
        ExperimentParticipant.objects.create(
            experiment=self.experiment,
            student=self.student_a,
            group="control",
            pre_score=50,
            post_score=55,
        )
        ExperimentParticipant.objects.create(
            experiment=self.experiment,
            student=self.student_b,
            group="experimental",
            pre_score=50,
            post_score=70,
        )

        response = self.client.get(f"/api/lessons/experiments/{self.experiment.id}/export-csv/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv")
        body = response.content.decode("utf-8")
        self.assertIn("P-value (approx)", body)
        self.assertIn("Effect size (Cohen's d)", body)
        self.assertIn("Stat method", body)

    def test_student_cannot_access_experiment_auto_split(self):
        self.client.force_authenticate(self.student_a)
        response = self.client.post(f"/api/lessons/experiments/{self.experiment.id}/auto-split/", {}, format="json")
        self.assertEqual(response.status_code, 403)


class AssignmentContentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.teacher = User.objects.create_user(username="teacher_content", password="pass1234", role="teacher")
        self.student = User.objects.create_user(username="student_content", password="pass1234", role="student")
        self.lesson = Lesson.objects.create(
            owner=self.teacher,
            title="Дерекқор негіздері",
            topic="База данных",
        )
        Enrollment.objects.create(student=self.student, lesson=self.lesson)

    def test_assignment_create_autofills_description(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.post(
            "/api/lessons/assignments/",
            {
                "lesson": self.lesson.id,
                "title": "Quiz тапсырмасы",
                "assignment_type": "quiz",
                "description": "",
                "is_published": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue((response.data.get("description") or "").strip())
        self.assertIn("Тақырып", response.data.get("description"))

    def test_assignment_create_maps_other_to_template_type(self):
        template = SlideTemplate.objects.create(
            title="Grouping DB",
            author=self.teacher,
            template_type="grouping",
            data={
                "groups": [
                    {"title": "Кілттер", "items": ["Primary Key", "Foreign Key"]},
                    {"title": "Операциялар", "items": ["SELECT", "INSERT"]},
                ]
            },
        )
        self.client.force_authenticate(self.teacher)
        response = self.client.post(
            "/api/lessons/assignments/",
            {
                "lesson": self.lesson.id,
                "title": "Grouping тапсырмасы",
                "assignment_type": "other",
                "content_id": template.id,
                "description": "",
                "is_published": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data.get("assignment_type"), "grouping")
        self.assertEqual(response.data.get("effective_assignment_type"), "grouping")
        self.assertTrue((response.data.get("description") or "").strip())

    def test_student_can_retrieve_assigned_template(self):
        template = SlideTemplate.objects.create(
            title="Flashcards DB",
            author=self.teacher,
            template_type="flashcards",
            data={
                "cards": [
                    {"front": "Primary Key", "back": "Бірегей кілт"},
                    {"front": "JOIN", "back": "Кестелерді біріктіру"},
                ]
            },
        )
        Assignment.objects.create(
            lesson=self.lesson,
            title="Flashcards тапсырмасы",
            assignment_type="flashcards",
            content_id=template.id,
            is_published=True,
        )

        self.client.force_authenticate(self.student)
        response = self.client.get(f"/api/slide/templates/{template.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data.get("id"), template.id)
