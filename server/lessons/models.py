from django.db import models
from django.conf import settings

class Lesson(models.Model):
    title = models.CharField(max_length=255)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='lessons')
    created_at = models.DateTimeField(auto_now_add=True)
    is_shared = models.BooleanField(default=False)
    share_code = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return self.title
