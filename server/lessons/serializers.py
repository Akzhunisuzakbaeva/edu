from rest_framework import serializers
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
from .assignment_content import normalize_assignment_type

try:
    from slide.models import SlideTemplate
except Exception:
    SlideTemplate = None

class LessonSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)

    class Meta:
        model = Lesson
        fields = [
            "id",
            "owner",
            "owner_username",
            "title",
            "description",
            "subject",
            "grade",
            "topic",
            "objectives",
            "materials",
            "homework",
            "assessment",
            "resources",
            "duration_minutes",
            "is_shared",
            "share_code",
            "created_at",
        ]
        read_only_fields = ["id", "owner", "share_code", "created_at"]


class EnrollmentSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)
    lesson_title = serializers.CharField(source="lesson.title", read_only=True)

    class Meta:
        model = Enrollment
        fields = ["id", "student", "student_username", "lesson", "lesson_title", "joined_at"]
        read_only_fields = ["id", "student", "joined_at"]


class AssignmentSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source="lesson.title", read_only=True)
    effective_assignment_type = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            "id",
            "lesson",
            "lesson_title",
            "title",
            "description",
            "assignment_type",
            "effective_assignment_type",
            "content_id",
            "due_at",
            "is_published",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_effective_assignment_type(self, obj):
        template_type = None
        if SlideTemplate and obj.content_id:
            template_type = (
                SlideTemplate.objects.filter(id=obj.content_id)
                .values_list("template_type", flat=True)
                .first()
            )
        return normalize_assignment_type(obj.assignment_type, template_type)


class SubmissionSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)
    assignment_title = serializers.CharField(source="assignment.title", read_only=True)

    class Meta:
        model = Submission
        fields = [
            "id",
            "assignment",
            "assignment_title",
            "student",
            "student_username",
            "text",
            "file",
            "duration_seconds",
            "score",
            "feedback",
            "submitted_at",
        ]
        read_only_fields = ["id", "student", "submitted_at"]


class AssignmentAssigneeSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)

    class Meta:
        model = AssignmentAssignee
        fields = ["id", "assignment", "student", "student_username", "assigned_at"]
        read_only_fields = ["id", "assigned_at"]


class RewardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reward
        fields = ["id", "student", "title", "description", "level", "icon", "created_at"]
        read_only_fields = ["id", "student", "created_at"]


class ExperimentParticipantSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)

    class Meta:
        model = ExperimentParticipant
        fields = [
            "id",
            "experiment",
            "student",
            "student_username",
            "group",
            "pre_score",
            "post_score",
            "pre_motivation",
            "post_motivation",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "student_username", "created_at", "updated_at"]

    def validate(self, attrs):
        for field in ("pre_score", "post_score"):
            if field in attrs and attrs[field] is not None:
                if attrs[field] < 0 or attrs[field] > 100:
                    raise serializers.ValidationError({field: "Score must be between 0 and 100."})
        for field in ("pre_motivation", "post_motivation"):
            if field in attrs and attrs[field] is not None:
                if attrs[field] < 0 or attrs[field] > 10:
                    raise serializers.ValidationError({field: "Motivation must be between 0 and 10."})
        return attrs


class ExperimentSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source="lesson.title", read_only=True)
    participants_count = serializers.IntegerField(source="participants.count", read_only=True)
    participants = ExperimentParticipantSerializer(many=True, read_only=True)

    class Meta:
        model = Experiment
        fields = [
            "id",
            "teacher",
            "lesson",
            "lesson_title",
            "title",
            "focus_topic",
            "hypothesis",
            "pre_start",
            "pre_end",
            "post_start",
            "post_end",
            "notes",
            "is_active",
            "participants_count",
            "participants",
            "created_at",
        ]
        read_only_fields = ["id", "teacher", "lesson_title", "participants_count", "participants", "created_at"]

    def validate(self, attrs):
        pre_start = attrs.get("pre_start", getattr(self.instance, "pre_start", None))
        pre_end = attrs.get("pre_end", getattr(self.instance, "pre_end", None))
        post_start = attrs.get("post_start", getattr(self.instance, "post_start", None))
        post_end = attrs.get("post_end", getattr(self.instance, "post_end", None))

        if pre_start and pre_end and pre_start > pre_end:
            raise serializers.ValidationError({"pre_end": "pre_end must be greater than or equal to pre_start."})
        if post_start and post_end and post_start > post_end:
            raise serializers.ValidationError({"post_end": "post_end must be greater than or equal to post_start."})
        if pre_end and post_start and pre_end > post_start:
            raise serializers.ValidationError(
                {"post_start": "post_start must be on or after pre_end for clean pre/post split."}
            )
        return attrs
