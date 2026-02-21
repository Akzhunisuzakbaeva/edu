from django.contrib import admin
from .models import GameSession, Player

@admin.register(GameSession)
class GameSessionAdmin(admin.ModelAdmin):
    list_display = ("title", "code", "teacher", "is_active", "created_at")
    search_fields = ("title", "code", "teacher__email")


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ("name", "session", "score", "joined_at")
    search_fields = ("name", "session__code")
