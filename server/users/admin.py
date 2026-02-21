from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import AdaptiveRule, LearningTrajectoryNode, StudentProfile, User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    model = User
    list_display = ("id", "username", "email", "role", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active")
    fieldsets = UserAdmin.fieldsets + (
        ("Қосымша", {"fields": ("role",)}),
    )


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "student",
        "learning_level",
        "average_score",
        "completion_rate",
        "total_points",
        "updated_at",
    )
    search_fields = ("student__username", "student__email", "interest_focus")
    list_filter = ("learning_level",)


@admin.register(LearningTrajectoryNode)
class LearningTrajectoryNodeAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "student",
        "lesson",
        "topic",
        "order_index",
        "status",
        "mastery",
        "required_score",
    )
    search_fields = ("student__username", "lesson__title", "topic")
    list_filter = ("status",)


@admin.register(AdaptiveRule)
class AdaptiveRuleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "action",
        "min_success_rate",
        "max_success_rate",
        "min_attempts",
        "is_active",
    )
    list_filter = ("action", "is_active")
