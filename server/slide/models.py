from django.db import models, transaction
from django.db.models import Max
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from lessons.models import Lesson
from django.utils import timezone

User = get_user_model()


def _empty_dict():
    """JSONField үшін қауіпсіз mutable default."""
    return {}


class Slide(models.Model):
    """
    Бір сабақ ішіндегі бір слайд.
    """
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name='slides',
    )
    title = models.CharField(max_length=255, default='Untitled')
    order = models.PositiveIntegerField(default=1)  # сабақ ішіндегі реті
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["lesson_id", "order", "id"]
        unique_together = [("lesson", "order")]

    def __str__(self):
        return f"{self.title} (lesson={self.lesson_id}, order={self.order})"

    def save(self, *args, **kwargs):
        if self.pk is None:
            with transaction.atomic():
                if self.lesson_id is None:
                    # Let default FK validation handle missing lesson
                    return super().save(*args, **kwargs)

                existing = None
                if self.order is not None:
                    existing = (
                        Slide.objects.filter(lesson_id=self.lesson_id, order=self.order)
                        .exclude(pk=self.pk)
                        .exists()
                    )

                if self.order is None or existing:
                    max_order = (
                        Slide.objects.filter(lesson_id=self.lesson_id)
                        .aggregate(Max("order"))
                        .get("order__max")
                    )
                    self.order = (max_order or 0) + 1

                return super().save(*args, **kwargs)

        return super().save(*args, **kwargs)


class SlideObject(models.Model):
    """
    Слайд ішіндегі кез келген элемент.
    - object_type контенттің түрін анықтайды
    - data: түрге тән қасиеттер (мәтін, url, path, түс, т.б.)
    - position: {x, y, width, height} — пиксельмен немесе %-пен (фронтенд шешеді)
    """
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
        related_name='slide_objects',  # avoid clobbering Slide.objects manager
    )
    object_type = models.CharField(
        max_length=32,
        choices=OBJECT_TYPE_CHOICES,
    )

    # Түрге тән деректер (мысалы)
    # text:   {"text": "...", "fontSize": 24, "color": "#fff", ...}
    # image:  {"url": "https://...", "alt": "..."}
    # shape:  {"shapeType": "rect|circle|line", "stroke": "#...", "fill": "...", ...}
    # drawing:{"path":[[x,y],[x,y],...], "stroke":"#...", "strokeWidth":4}
    # attachment: {"name":"Homework.pdf", "url":"https://..."}
    data = models.JSONField(default=_empty_dict, help_text="Typed payload")

    # Орналасу (пиксель немесе пайыз — фронтенд интерпретациялайды)
    # {"x": 100, "y": 150, "width": 400, "height": 120}
    position = models.JSONField(default=_empty_dict)

    z_index = models.IntegerField(default=0)   # қабат реті
    rotation = models.FloatField(default=0.0)  # градус
    is_locked = models.BooleanField(default=False)

    author = models.ForeignKey(
        User,
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

    # Негізгі валидация (миграцияға әсер етпейді, сақтарда/админде жұмыс істейді)
    def clean(self):
        # position құрамын жеңіл тексеру
        pos = self.position or {}
        for k in ("x", "y", "width", "height"):
            if k not in pos:
                # позиция міндетті емес — фронтенд кейін де бере алады,
                # сондықтан қатты талап етпейміз. Қаласаңыз, мына check-ті қатаң етесіз.
                continue

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
    """
    Бір немесе бірнеше слайдқа қолданылатын шаблон.
    """
    TEMPLATE_TYPE_CHOICES = [
        ("quiz", "Quiz"),
        ("matching", "Matching"),
        ("flashcards", "Flashcards"),
        ("poll", "Poll/Survey"),
        ("crossword", "Crossword"),
    ]

    title = models.CharField(max_length=255)
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="templates")
    preview_image = models.ImageField(upload_to="template_previews/", null=True, blank=True)
    template_type = models.CharField(max_length=32, choices=TEMPLATE_TYPE_CHOICES, default="quiz")

    # Template configuration (e.g., quiz Q&A, matching pairs, etc.)
    data = models.JSONField(help_text="Template config (e.g., quiz Q&A, matching pairs, etc.)")
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
        User,
        on_delete=models.SET_NULL,
        related_name="submissions",
        null=True,
        blank=True,
    )
    data = models.JSONField(default=_empty_dict)
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
