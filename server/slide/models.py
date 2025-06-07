from django.db import models

class Slide(models.Model):
    lesson = models.ForeignKey('lessons.Lesson', on_delete=models.CASCADE, related_name='slides')
    title = models.CharField(max_length=255)
    content = models.TextField(blank=True)
    image = models.ImageField(upload_to='slides/', blank=True, null=True)
    drawing_data = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class SlideObject(models.Model):
    slide = models.ForeignKey(Slide, on_delete=models.CASCADE, related_name='objects')
    object_type = models.CharField(
        max_length=20,
        choices=[('text', 'Text'), ('image', 'Image'), ('drawing', 'Drawing')]
    )
    data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.object_type} on Slide {self.slide.id}"
