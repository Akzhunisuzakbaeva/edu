import uuid
from django.conf import settings
from django.db import models


class Lesson(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lessons",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    subject = models.CharField(max_length=120, blank=True, default="")
    grade = models.CharField(max_length=50, blank=True, default="")
    topic = models.CharField(max_length=255, blank=True, default="")
    objectives = models.TextField(blank=True)
    materials = models.TextField(blank=True)
    homework = models.TextField(blank=True)
    assessment = models.TextField(blank=True)
    resources = models.TextField(blank=True)
    duration_minutes = models.IntegerField(null=True, blank=True)

    is_shared = models.BooleanField(default=False)
    share_code = models.CharField(max_length=32, blank=True, null=True, unique=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.is_shared and not self.share_code:
            self.share_code = uuid.uuid4().hex[:10]
        if not self.is_shared:
            self.share_code = None
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class Enrollment(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lesson_submissions",
        related_query_name="lesson_submission",
    )
    lesson = models.ForeignKey(
        "lessons.Lesson",
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("student", "lesson")

    def __str__(self):
        return f"{self.student} → {self.lesson}"


class Assignment(models.Model):
    TYPE_CHOICES = [
        ("quiz", "Quiz"),
        ("sorting", "Sorting"),
        ("matching", "Matching"),
        ("poll", "Poll"),
        ("slides", "Slides"),
        ("grouping", "Grouping"),
        ("flashcards", "Flashcards"),
        ("crossword", "Crossword"),
        ("other", "Other"),
    ]

    lesson = models.ForeignKey(
        "lessons.Lesson",
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    title = models.CharField(max_length=255, default="New assignment")
    description = models.TextField(blank=True)

    assignment_type = models.CharField(max_length=32, choices=TYPE_CHOICES, default="quiz")
    content_id = models.IntegerField(null=True, blank=True)

    due_at = models.DateTimeField(null=True, blank=True)
    is_published = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class AssignmentAssignee(models.Model):
    assignment = models.ForeignKey(
        "lessons.Assignment",
        on_delete=models.CASCADE,
        related_name="assignees",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assigned_tasks",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("assignment", "student")
        ordering = ["-assigned_at"]

    def __str__(self):
        return f"{self.student} ← {self.assignment}"


class Submission(models.Model):
    assignment = models.ForeignKey(
        "lessons.Assignment",
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    text = models.TextField(blank=True)
    file = models.FileField(upload_to="submissions/", blank=True, null=True)
    duration_seconds = models.PositiveIntegerField(default=0)
    score = models.FloatField(null=True, blank=True)
    feedback = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("assignment", "student")
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"{self.student} → {self.assignment}"


class Reward(models.Model):
    LEVEL_CHOICES = [
        ("gold", "Gold"),
        ("silver", "Silver"),
        ("special", "Special"),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="rewards",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default="silver")
    icon = models.CharField(max_length=10, default="🏆")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.student} · {self.title}"


class Experiment(models.Model):
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="experiments",
    )
    lesson = models.ForeignKey(
        "lessons.Lesson",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="experiments",
    )

    title = models.CharField(max_length=255, default="База данных бойынша эксперимент")
    focus_topic = models.CharField(max_length=255, default="База данных")
    hypothesis = models.TextField(
        blank=True,
        default=(
            "Интерактивті және адаптивті веб-қосымша қолданылған эксперименттік топтың "
            "білім нәтижесі мен мотивациясы бақылау тобына қарағанда жоғары болады."
        ),
    )
    pre_start = models.DateField(null=True, blank=True)
    pre_end = models.DateField(null=True, blank=True)
    post_start = models.DateField(null=True, blank=True)
    post_end = models.DateField(null=True, blank=True)

    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.title


class ExperimentParticipant(models.Model):
    GROUP_CHOICES = [
        ("control", "Control"),
        ("experimental", "Experimental"),
    ]

    experiment = models.ForeignKey(
        "lessons.Experiment",
        on_delete=models.CASCADE,
        related_name="participants",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="experiment_participations",
    )
    group = models.CharField(max_length=20, choices=GROUP_CHOICES, default="control")

    pre_score = models.FloatField(null=True, blank=True)
    post_score = models.FloatField(null=True, blank=True)
    pre_motivation = models.FloatField(null=True, blank=True)
    post_motivation = models.FloatField(null=True, blank=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("experiment", "student")
        ordering = ["group", "student_id", "id"]

    def __str__(self):
        return f"{self.experiment_id}:{self.student_id}:{self.group}"
