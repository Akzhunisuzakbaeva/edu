from django.contrib import admin
from .models import LiveSession, LiveParticipant, LiveSlideCheckin


@admin.register(LiveSession)
class LiveSessionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "lesson",
        "teacher",
        "source_type",
        "live_code",
        "is_active",
        "current_slide_index",
        "started_at",
    )
    search_fields = ("live_code", "lesson__title", "teacher__username")
    list_filter = ("is_active", "source_type", "started_at")


@admin.register(LiveParticipant)
class LiveParticipantAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "live_session",
        "student",
        "points",
        "streak",
        "best_streak",
        "checkins_count",
        "last_seen_at",
    )
    search_fields = ("student__username", "display_name", "live_session__live_code")
    list_filter = ("joined_at", "last_seen_at")


@admin.register(LiveSlideCheckin)
class LiveSlideCheckinAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "live_session",
        "participant",
        "slide_index",
        "reaction_ms",
        "points_awarded",
        "created_at",
    )
    search_fields = ("live_session__live_code", "participant__student__username")
    list_filter = ("slide_index", "created_at")
