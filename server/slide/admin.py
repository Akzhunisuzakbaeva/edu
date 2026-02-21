from django.contrib import admin
from .models import Slide, SlideObject, SlideTemplate, Submission


@admin.register(Slide)
class SlideAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "lesson", "order")
    list_filter = ("lesson",)
    ordering = ("lesson", "order")


@admin.register(SlideObject)
class SlideObjectAdmin(admin.ModelAdmin):
    list_display = ("id", "object_type", "slide", "z_index", "is_locked")
    list_filter = ("object_type",)
    search_fields = ("object_type",)


@admin.register(SlideTemplate)
class SlideTemplateAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "template_type", "author", "created_at")
    list_filter = ("template_type",)


@admin.register(Submission)
class SlideSubmissionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "slide", "template", "duration_seconds", "score", "created_at")
