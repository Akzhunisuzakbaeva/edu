from rest_framework import serializers
from .models import SortingTemplate


class SortingTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SortingTemplate
        fields = ["id", "title", "template_type", "data", "created_at"]
