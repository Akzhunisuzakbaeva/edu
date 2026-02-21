from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = (
        ("teacher", "Teacher"),
        ("student", "Student"),
    )
    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES,
        default="student"
    )
    full_name = models.CharField(max_length=120, blank=True, default="")
    school = models.CharField(max_length=200, blank=True, default="")
    subject = models.CharField(max_length=120, blank=True, default="")


class StudentProfile(models.Model):
    LEVEL_CHOICES = (
        ("beginner", "Beginner"),
        ("intermediate", "Intermediate"),
        ("advanced", "Advanced"),
    )

    student = models.OneToOneField(
        "users.User",
        on_delete=models.CASCADE,
        related_name="student_profile",
    )
    learning_level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default="beginner")

    # Editable personalization fields
    interest_focus = models.CharField(max_length=255, blank=True, default="")
    preferred_formats = models.JSONField(default=list, blank=True)
    learning_goals = models.TextField(blank=True, default="")

    # Computed analytics/personalization fields
    average_score = models.FloatField(default=0.0)
    completion_rate = models.FloatField(default=0.0)
    total_points = models.IntegerField(default=0)
    total_time_seconds = models.IntegerField(default=0)

    weak_topics = models.JSONField(default=list, blank=True)
    strong_topics = models.JSONField(default=list, blank=True)
    progress_history = models.JSONField(default=list, blank=True)

    last_recommendation = models.CharField(max_length=255, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return f"Profile<{self.student_id}>"


class LearningTrajectoryNode(models.Model):
    STATUS_CHOICES = (
        ("locked", "Locked"),
        ("unlocked", "Unlocked"),
        ("in_progress", "In Progress"),
        ("review", "Needs Review"),
        ("completed", "Completed"),
    )

    student = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="trajectory_nodes",
    )
    lesson = models.ForeignKey(
        "lessons.Lesson",
        on_delete=models.CASCADE,
        related_name="trajectory_nodes",
    )

    topic = models.CharField(max_length=255)
    order_index = models.PositiveIntegerField(default=1)
    required_score = models.FloatField(default=0.6)
    mastery = models.FloatField(default=0.0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="locked")
    recommendation = models.CharField(max_length=255, blank=True, default="")

    unlocked_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("student", "lesson")
        ordering = ["student_id", "order_index", "id"]

    def __str__(self):
        return f"Trajectory<{self.student_id}:{self.lesson_id}:{self.status}>"


class AdaptiveRule(models.Model):
    ACTION_CHOICES = (
        ("increase_difficulty", "Increase Difficulty"),
        ("decrease_difficulty", "Decrease Difficulty"),
        ("reinforce_topic", "Reinforce Weak Topics"),
    )

    name = models.CharField(max_length=120, unique=True)
    min_success_rate = models.FloatField(default=0.0)
    max_success_rate = models.FloatField(default=1.0)
    min_attempts = models.PositiveIntegerField(default=3)
    action = models.CharField(max_length=30, choices=ACTION_CHOICES, default="reinforce_topic")
    recommendation_template = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["min_success_rate", "id"]

    def __str__(self):
        return self.name
