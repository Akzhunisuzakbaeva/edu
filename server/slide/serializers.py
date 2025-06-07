from rest_framework import serializers
from .models import Slide, SlideObject

class SlideObjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = SlideObject
        fields = '__all__'

class SlideSerializer(serializers.ModelSerializer):
    objects = SlideObjectSerializer(many=True, read_only=True)

    class Meta:
        model = Slide
        fields = '__all__'
