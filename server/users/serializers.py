from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import AdaptiveRule, LearningTrajectoryNode, StudentProfile

User = get_user_model()


def _fallback_full_name(payload: dict) -> str:
    raw = (payload.get("full_name") or "").strip()
    if raw:
        return raw
    username = str(payload.get("username") or "").strip()
    if "@" in username:
        username = username.split("@", 1)[0]
    username = username.replace("_", " ").replace("-", " ").strip()
    return " ".join(part.capitalize() for part in username.split()) if username else "User"


# ✅ REGISTER
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "role", "full_name", "school", "subject")

    def create(self, validated_data):
        role = validated_data.get("role") or "teacher"
        if role != "teacher":
            raise serializers.ValidationError({"role": "Only teachers can register."})
        validated_data["role"] = "teacher"
        validated_data["full_name"] = _fallback_full_name(validated_data)
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

class CreateStudentSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "full_name")

    def create(self, validated_data):
        validated_data["full_name"] = _fallback_full_name(validated_data)
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.role = "student"
        user.set_password(password)
        user.save()
        StudentProfile.objects.get_or_create(student=user)
        return user

# ✅ ME (/auth/me/)
class MeSerializer(serializers.ModelSerializer):
    learning_level = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "role", "full_name", "school", "subject", "learning_level")

    def get_learning_level(self, obj):
        profile = getattr(obj, "student_profile", None)
        if not profile:
            return None
        return profile.learning_level


# ✅ LOGIN (JWT + role)
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = getattr(user, "role", None)
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["role"] = getattr(self.user, "role", None)
        data["user_id"] = self.user.id
        data["email"] = getattr(self.user, "email", "")
        return data


class LearningTrajectoryNodeSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source="lesson.title", read_only=True)

    class Meta:
        model = LearningTrajectoryNode
        fields = (
            "id",
            "lesson",
            "lesson_title",
            "topic",
            "order_index",
            "required_score",
            "mastery",
            "status",
            "recommendation",
            "unlocked_at",
            "completed_at",
            "updated_at",
        )


class StudentProfileSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)
    trajectory = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = (
            "id",
            "student",
            "student_username",
            "learning_level",
            "interest_focus",
            "preferred_formats",
            "learning_goals",
            "average_score",
            "completion_rate",
            "total_points",
            "total_time_seconds",
            "weak_topics",
            "strong_topics",
            "progress_history",
            "last_recommendation",
            "trajectory",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "student",
            "student_username",
            "learning_level",
            "average_score",
            "completion_rate",
            "total_points",
            "total_time_seconds",
            "weak_topics",
            "strong_topics",
            "progress_history",
            "last_recommendation",
            "trajectory",
            "created_at",
            "updated_at",
        )

    def validate_preferred_formats(self, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("preferred_formats must be an array.")
        normalized = []
        for item in value:
            text = str(item).strip()
            if text:
                normalized.append(text)
        return normalized[:10]

    def get_trajectory(self, obj):
        nodes = obj.student.trajectory_nodes.all()
        return LearningTrajectoryNodeSerializer(nodes, many=True).data


class AdaptiveRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdaptiveRule
        fields = (
            "id",
            "name",
            "min_success_rate",
            "max_success_rate",
            "min_attempts",
            "action",
            "recommendation_template",
            "is_active",
        )
