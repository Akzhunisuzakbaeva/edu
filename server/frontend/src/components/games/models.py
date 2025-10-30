# server/games/models.py
from django.db import models

class GameTemplate(models.Model):
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=50, default="kazakh_game")
    description = models.TextField(blank=True)
    config = models.JSONField(default=dict)  # ойын параметрлері (сұрақтар, таймер, т.б.)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
