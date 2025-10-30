from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()

class GameSession(models.Model):
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name="game_sessions")
    title = models.CharField(max_length=200)
    code = models.CharField(max_length=8, unique=True, default=uuid.uuid4().hex[:8].upper)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.code})"


class Player(models.Model):
    session = models.ForeignKey(GameSession, on_delete=models.CASCADE, related_name="players")
    name = models.CharField(max_length=100)
    score = models.IntegerField(default=0)
    joined_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} — {self.session.code}"
