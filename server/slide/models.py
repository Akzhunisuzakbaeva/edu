from django.conf import settings
from django.db import models, transaction
from django.db.models import Max
from django.core.exceptions import ValidationError
from django.utils import timezone


def _empty_dict():
    return {}


USER_MODEL = settings.AUTH_USER_MODEL


class Slide(models.Model):
    lesson = models.ForeignKey(
        "lessons.Lesson",
        on_delete=models.CASCADE,
        related_name="slides",
    )
    title = models.CharField(max_length=255, default="Untitled")
    order = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["lesson_id", "order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["lesson", "order"], name="uniq_slide_order_per_lesson")
        ]

    def __str__(self):
        return f"{self.title} (lesson={self.lesson_id}, order={self.order})"

    def save(self, *args, **kwargs):
        # жаңа слайд болса ғана order авто-есептейміз
        if self.pk is None:
            with transaction.atomic():
                if not self.lesson_id:
                    return super().save(*args, **kwargs)

                # Егер order бос немесе дубль болса, соңына қоямыз
                exists_same = Slide.objects.filter(
                    lesson_id=self.lesson_id, order=self.order
                ).exists()

                if self.order is None or exists_same:
                    max_order = (
                        Slide.objects.filter(lesson_id=self.lesson_id)
                        .aggregate(Max("order"))
                        .get("order__max")
                    )
                    self.order = (max_order or 0) + 1

                return super().save(*args, **kwargs)

        return super().save(*args, **kwargs)


class SlideObject(models.Model):
    TEXT = "text"
    IMAGE = "image"
    DRAWING = "drawing"
    SHAPE = "shape"
    ATTACHMENT = "attachment"
    CHECKBOX = "checkbox"

    OBJECT_TYPE_CHOICES = (
        (TEXT, "Text"),
        (IMAGE, "Image"),
        (DRAWING, "Drawing"),
        (SHAPE, "Shape"),
        (ATTACHMENT, "Attachment"),
        (CHECKBOX, "Checkbox"),
    )

    slide = models.ForeignKey(
        Slide,
        on_delete=models.CASCADE,
        related_name="slide_objects",
    )
    object_type = models.CharField(max_length=32, choices=OBJECT_TYPE_CHOICES)

    data = models.JSONField(default=_empty_dict, help_text="Typed payload")
    position = models.JSONField(default=_empty_dict)

    z_index = models.IntegerField(default=0)
    rotation = models.FloatField(default=0.0)
    is_locked = models.BooleanField(default=False)

    author = models.ForeignKey(
        USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="slide_objects",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["slide_id", "z_index", "id"]
        indexes = [
            models.Index(fields=["slide", "object_type"]),
            models.Index(fields=["slide", "z_index"]),
        ]

    def __str__(self):
        return f"{self.object_type} on slide {self.slide_id}"

    def clean(self):
        d = self.data or {}

        if self.object_type == self.TEXT and "text" not in d:
            raise ValidationError("For object_type='text' data must include 'text'.")

        if self.object_type == self.IMAGE and "url" not in d:
            raise ValidationError("For object_type='image' data must include 'url'.")

        if self.object_type == self.SHAPE and "shapeType" not in d:
            raise ValidationError("For object_type='shape' data must include 'shapeType'.")

        if self.object_type == self.DRAWING and "path" not in d:
            raise ValidationError("For object_type='drawing' data must include 'path'.")


class SlideTemplate(models.Model):
    TEMPLATE_TYPE_CHOICES = [
        ("quiz", "Quiz"),
        ("matching", "Matching"),
        ("flashcards", "Flashcards"),
        ("poll", "Poll/Survey"),
        ("crossword", "Crossword"),
        ("sorting", "Sorting"),
        ("grouping", "Grouping"),
    ]

    title = models.CharField(max_length=255)
    author = models.ForeignKey(USER_MODEL, on_delete=models.CASCADE, related_name="templates")
    preview_image = models.ImageField(upload_to="template_previews/", null=True, blank=True)
    template_type = models.CharField(max_length=32, choices=TEMPLATE_TYPE_CHOICES, default="quiz")

    data = models.JSONField(help_text="Template config (quiz/matching/etc.)")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "id"]

    def __str__(self):
        return self.title


class Submission(models.Model):
    slide = models.ForeignKey(
        Slide,
        on_delete=models.SET_NULL,
        related_name="submissions",
        null=True,
        blank=True,
    )
    template = models.ForeignKey(
        SlideTemplate,
        on_delete=models.SET_NULL,
        related_name="submissions",
        null=True,
        blank=True,
    )
    user = models.ForeignKey(
    USER_MODEL,
    on_delete=models.SET_NULL,
    related_name="slide_submissions",
    related_query_name="slide_submission",
    null=True,
    blank=True,
)

    data = models.JSONField(default=_empty_dict)
    duration_seconds = models.PositiveIntegerField(default=0)
    score = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "id"]

    def clean(self):
        if not self.slide and not self.template:
            raise ValidationError("Either slide or template must be provided.")

    def __str__(self):
        parts = []
        if self.slide_id:
            parts.append(f"slide={self.slide_id}")
        if self.template_id:
            parts.append(f"template={self.template_id}")
        descriptor = ", ".join(parts) or "unlinked"
        return f"Submission {self.pk or 'unsaved'} ({descriptor})"
