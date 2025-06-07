
from rest_framework import serializers
from .models import Lesson

class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ['id', 'title', 'owner', 'created_at', 'is_shared', 'share_code']
        read_only_fields = ['id', 'owner', 'created_at', 'share_code']
