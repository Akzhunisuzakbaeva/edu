from django.contrib import admin

try:
    from .models import (
        Lesson,
        Enrollment,
        Assignment,
        Submission,
        AssignmentAssignee,
        Experiment,
        ExperimentParticipant,
    )
except Exception as e:
    Lesson = Enrollment = Assignment = Submission = AssignmentAssignee = Experiment = ExperimentParticipant = None
    print("LESSONS ADMIN IMPORT ERROR:", repr(e))


if Lesson:
    @admin.register(Lesson)
    class LessonAdmin(admin.ModelAdmin):
        list_display = ("id", "title", "owner", "is_shared", "share_code", "created_at")
        search_fields = ("title", "share_code")
        list_filter = ("is_shared",)

if Enrollment:
    @admin.register(Enrollment)
    class EnrollmentAdmin(admin.ModelAdmin):
        list_display = ("id", "student", "lesson", "joined_at")
        search_fields = ("student__username", "lesson__title")

if Assignment:
    @admin.register(Assignment)
    class AssignmentAdmin(admin.ModelAdmin):
        list_display = ("id", "title", "lesson", "assignment_type", "due_at", "is_published", "created_at")
        search_fields = ("title", "lesson__title")
        list_filter = ("assignment_type", "is_published")

if AssignmentAssignee:
    @admin.register(AssignmentAssignee)
    class AssignmentAssigneeAdmin(admin.ModelAdmin):
        list_display = ("id", "assignment", "student", "assigned_at")
        search_fields = ("assignment__title", "student__username")

if Submission:
    @admin.register(Submission)
    class SubmissionAdmin(admin.ModelAdmin):
        list_display = ("id", "assignment", "student", "duration_seconds", "score", "submitted_at")
        search_fields = ("assignment__title", "student__username")

if Experiment:
    @admin.register(Experiment)
    class ExperimentAdmin(admin.ModelAdmin):
        list_display = ("id", "title", "focus_topic", "teacher", "lesson", "is_active", "created_at")
        list_filter = ("is_active", "focus_topic")
        search_fields = ("title", "focus_topic", "teacher__username", "lesson__title")

if ExperimentParticipant:
    @admin.register(ExperimentParticipant)
    class ExperimentParticipantAdmin(admin.ModelAdmin):
        list_display = (
            "id",
            "experiment",
            "student",
            "group",
            "pre_score",
            "post_score",
            "pre_motivation",
            "post_motivation",
        )
        list_filter = ("group",)
        search_fields = ("student__username", "experiment__title")
