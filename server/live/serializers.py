from rest_framework import serializers
from datetime import timedelta
from django.utils import timezone

from .models import LiveSession, LiveParticipant
from lessons.models import Lesson


class LiveSessionSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source="lesson.title", read_only=True)
    pptx_file_url = serializers.SerializerMethodField()
    pptx_preview_url = serializers.SerializerMethodField()
    content_url = serializers.SerializerMethodField()
    timer_is_running = serializers.SerializerMethodField()
    timer_remaining_seconds = serializers.SerializerMethodField()
    participants_online = serializers.SerializerMethodField()

    class Meta:
        model = LiveSession
        fields = [
            "id",
            "lesson",
            "lesson_title",
            "teacher",
            "is_active",
            "current_slide_index",
            "live_code",
            "source_type",
            "canva_embed_url",
            "external_view_url",
            "pptx_file",
            "pptx_preview_pdf",
            "pptx_file_url",
            "pptx_preview_url",
            "content_url",
            "timer_duration_seconds",
            "timer_started_at",
            "timer_ends_at",
            "timer_is_running",
            "timer_remaining_seconds",
            "participants_online",
            "started_at",
            "ended_at",
        ]
        read_only_fields = [
            "teacher",
            "live_code",
            "pptx_preview_pdf",
            "pptx_file_url",
            "pptx_preview_url",
            "content_url",
            "timer_is_running",
            "timer_remaining_seconds",
            "participants_online",
            "started_at",
            "ended_at",
        ]

    def _absolute_url(self, url: str) -> str:
        if not url:
            return ""
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_pptx_file_url(self, obj):
        if not obj.pptx_file:
            return ""
        return self._absolute_url(obj.pptx_file.url)

    def get_content_url(self, obj):
        if obj.source_type == LiveSession.SOURCE_CANVA:
            return obj.canva_embed_url or ""
        if obj.source_type == LiveSession.SOURCE_URL:
            return obj.external_view_url or ""
        if obj.source_type == LiveSession.SOURCE_PPTX:
            if obj.pptx_preview_pdf:
                return self._absolute_url(obj.pptx_preview_pdf.url)
            return self._absolute_url(obj.pptx_file.url) if obj.pptx_file else ""
        return ""

    def get_pptx_preview_url(self, obj):
        if not obj.pptx_preview_pdf:
            return ""
        return self._absolute_url(obj.pptx_preview_pdf.url)

    def get_timer_is_running(self, obj):
        return obj.timer_is_running

    def get_timer_remaining_seconds(self, obj):
        return obj.timer_remaining_seconds

    def get_participants_online(self, obj):
        threshold = timezone.now() - timedelta(seconds=20)
        return obj.participants.filter(last_seen_at__gte=threshold).count()


class LiveParticipantSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="student.username", read_only=True)
    full_name = serializers.CharField(source="student.full_name", read_only=True)
    name = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()

    class Meta:
        model = LiveParticipant
        fields = [
            "id",
            "student",
            "username",
            "full_name",
            "display_name",
            "name",
            "points",
            "streak",
            "best_streak",
            "checkins_count",
            "current_slide_index",
            "joined_at",
            "last_seen_at",
            "is_online",
        ]
        read_only_fields = fields

    def get_name(self, obj):
        return obj.resolved_name

    def get_is_online(self, obj):
        return obj.last_seen_at >= timezone.now() - timedelta(seconds=20)


class StartLiveSessionSerializer(serializers.Serializer):
    lesson_id = serializers.IntegerField()
    source_type = serializers.ChoiceField(
        choices=LiveSession.SOURCE_CHOICES,
        required=False,
        default=LiveSession.SOURCE_SLIDES,
    )
    canva_embed_url = serializers.URLField(required=False, allow_blank=True)
    external_view_url = serializers.URLField(required=False, allow_blank=True)
    pptx_file = serializers.FileField(required=False, allow_null=True)

    def validate_lesson_id(self, value):
        if not Lesson.objects.filter(id=value).exists():
            raise serializers.ValidationError("Мұндай lesson жоқ.")
        return value

    def validate_pptx_file(self, value):
        if not value:
            return value
        name = (value.name or "").lower()
        if not name.endswith(".pptx"):
            raise serializers.ValidationError("Тек .pptx файл жүктеңіз.")
        max_size = 40 * 1024 * 1024
        if getattr(value, "size", 0) > max_size:
            raise serializers.ValidationError("PPTX файл 40MB-тен аспауы керек.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        source_type = attrs.get("source_type", LiveSession.SOURCE_SLIDES)

        if source_type == LiveSession.SOURCE_CANVA and not attrs.get("canva_embed_url"):
            raise serializers.ValidationError({"canva_embed_url": "Canva embed link міндетті."})
        if source_type == LiveSession.SOURCE_URL and not attrs.get("external_view_url"):
            raise serializers.ValidationError({"external_view_url": "Сілтеме (URL) міндетті."})
        if source_type == LiveSession.SOURCE_PPTX and not attrs.get("pptx_file"):
            raise serializers.ValidationError({"pptx_file": "PPTX файл міндетті."})

        return attrs


class SlideUpdateSerializer(serializers.Serializer):
    slide_index = serializers.IntegerField(min_value=0)


class LiveTimerSerializer(serializers.Serializer):
    duration_seconds = serializers.IntegerField(min_value=5, max_value=600)


class JoinLiveSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=120, required=False, allow_blank=True)


class HeartbeatSerializer(serializers.Serializer):
    current_slide_index = serializers.IntegerField(min_value=0, required=False)


class SlideCheckinSerializer(serializers.Serializer):
    slide_index = serializers.IntegerField(min_value=0)
    reaction_ms = serializers.IntegerField(min_value=0, max_value=120000, required=False, default=0)
    answer_data = serializers.JSONField(required=False, default=dict)

    def validate_answer_data(self, value):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("answer_data объект (dict) болуы керек.")
        return value
