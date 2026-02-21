from django.db import models
from django.conf import settings


class SortingTemplate(models.Model):
    """
    Lumio-style template: sorting / matching / quiz сияқты шаблон сақтаймыз
    MVP үшін тек sorting жеткілікті.
    """
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sorting_templates",
        null=True,
        blank=True,
    )

    title = models.CharField(max_length=255, default="Sorting template")
    template_type = models.CharField(max_length=32, default="sorting")

    # Django 3.1+ болса models.JSONField бар
    data = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return f"{self.title} ({self.template_type})"
