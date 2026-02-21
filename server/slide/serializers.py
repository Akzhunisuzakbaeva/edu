# slide/serializers.py
from django.db.models import Max
from rest_framework import serializers
from lessons.models import Lesson
from .models import Slide, SlideObject, SlideTemplate, Submission


class SlideSerializer(serializers.ModelSerializer):
    # ForeignKey: жазғанда id-мен беру үшін queryset керек,
    # оқығанда жай сан (id) болып шығады.
    lesson = serializers.PrimaryKeyRelatedField(queryset=Lesson.objects.all())

    class Meta:
        model = Slide
        fields = "__all__"

    def validate(self, attrs):
        attrs = super().validate(attrs)

        instance = getattr(self, 'instance', None)
        lesson = attrs.get('lesson') or (instance.lesson if instance else None)

        order_provided = 'order' in attrs
        order_value = attrs.get('order')

        if lesson and (not order_provided or order_value is None):
            max_order = (
                Slide.objects.filter(lesson=lesson)
                .exclude(pk=getattr(instance, 'pk', None))
                .aggregate(Max('order'))
                .get('order__max')
                or 0
            )
            attrs['order'] = max_order + 1

        return attrs


class SlideObjectSerializer(serializers.ModelSerializer):
    slide = serializers.PrimaryKeyRelatedField(queryset=Slide.objects.all())

    class Meta:
        model = SlideObject
        fields = "__all__"

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)
        object_type = attrs.get('object_type') or (instance.object_type if instance else None)
        data = attrs.get('data') or (instance.data if instance else {})

        if not object_type:
            raise serializers.ValidationError({"object_type": "This field is required."})

        if object_type == SlideObject.TEXT:
            if 'text' not in (data or {}):
                raise serializers.ValidationError({"data": "For object_type 'text', 'text' is required."})
        elif object_type == SlideObject.IMAGE:
            if 'url' not in (data or {}):
                raise serializers.ValidationError({"data": "For object_type 'image', 'url' is required."})
        elif object_type == SlideObject.SHAPE:
            if 'shapeType' not in (data or {}):
                raise serializers.ValidationError({"data": "For object_type 'shape', 'shapeType' is required."})
        elif object_type == SlideObject.DRAWING:
            if 'path' not in (data or {}):
                raise serializers.ValidationError({"data": "For object_type 'drawing', 'path' is required."})
        # attachment / checkbox do not have required keys by default

        return attrs


class SlideTemplateSerializer(serializers.ModelSerializer):
    # author серверде қойылады (read_only)
    class Meta:
        model = SlideTemplate
        fields = "__all__"
        read_only_fields = ["author", "created_at"]

    def validate(self, attrs):
        t = attrs.get("template_type", getattr(self.instance, "template_type", None))
        cfg = attrs.get("data", getattr(self.instance, "data", {})) or {}
        # Базалық тексеріс — type-қа сай минимал кілттер
        required = {
            "quiz": ["question", "options", "answer"],
            "matching": ["left", "right"],
            "flashcards": ["cards"],  # [{front,back}]
            "poll": ["question", "options"],
            "crossword": ["rows", "cols", "cells"],  # cells: [{r,c,letter/clue}]
            "sorting": ["items"],
            "grouping": ["groups"],
        }.get(t, [])
        for k in required:
            if k not in cfg:
                raise serializers.ValidationError({"data": f"Missing key for {t}: {k}"})
        return attrs


class SubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = "__all__"
        read_only_fields = ["user", "score", "created_at"]

    def validate(self, attrs):
        slide = attrs.get("slide") or getattr(self.instance, "slide", None)
        template = attrs.get("template") or getattr(self.instance, "template", None)
        data = attrs.get("data", getattr(self.instance, "data", {})) or {}
        duration_seconds = attrs.get(
            "duration_seconds",
            getattr(self.instance, "duration_seconds", 0),
        )

        if not slide and not template:
            raise serializers.ValidationError({"non_field_errors": ["Either slide or template must be provided."]})

        if not isinstance(data, dict):
            raise serializers.ValidationError({"data": "Submission payload must be a JSON object."})

        if duration_seconds is not None and duration_seconds < 0:
            raise serializers.ValidationError({"duration_seconds": "Duration cannot be negative."})

        template_type = None
        if template is not None:
            template_type = template.template_type

        if template_type == "quiz":
            if "answer" not in data and "answers" not in data:
                raise serializers.ValidationError(
                    {"data": {"answer": "Quiz үшін answer немесе answers өрісі қажет."}}
                )
        if template_type == "poll" and "answer" not in data:
            raise serializers.ValidationError(
                {"data": {"answer": "This field is required for poll submissions."}}
            )

        return attrs
