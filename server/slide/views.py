# server/slide/views.py
from collections import Counter
from typing import Optional

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction

from .models import Slide, SlideObject, SlideTemplate, Submission
from .serializers import (
    SlideSerializer,
    SlideObjectSerializer,
    SlideTemplateSerializer,
    SubmissionSerializer,
)
from lessons.models import Lesson


class SlideTemplateViewSet(viewsets.ModelViewSet):
    queryset = SlideTemplate.objects.all()
    serializer_class = SlideTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def _default_config(self, t: str):
        if t == "quiz":
            return {
                "question": "2 + 2 = ?",
                "options": ["3", "4", "5"],
                "answer": "4",
            }
        if t == "matching":
            return {
                "left": ["Apple", "Dog", "Blue"],
                "right": ["Color", "Fruit", "Animal"],
            }
        if t == "flashcards":
            return {
                "cards": [
                    {"front": "Capital of France", "back": "Paris"},
                    {"front": "2*3", "back": "6"},
                ]
            }
        if t == "poll":
            return {
                "question": "Which framework do you prefer?",
                "options": ["Django", "FastAPI", "Flask"],
            }
        if t == "crossword":
            return {
                "rows": 5, "cols": 5,
                "cells": [
                    {"r":0,"c":0,"letter":"C"}, {"r":0,"c":1,"letter":"A"},
                    {"r":0,"c":2,"letter":"T"}, {"r":1,"c":0,"letter":"A"},
                    {"r":1,"c":1,"letter":"P"}, {"r":1,"c":2,"letter":"I"},
                ],
                "clues": {"across": ["1: Animal"], "down": ["1: Beverage"]},
            }
        return {}

    @action(detail=False, methods=['post'], url_path='preset')
    def create_preset(self, request):
        t = request.data.get("template_type")
        title = request.data.get("title") or (f"{t.title()} Template" if isinstance(t, str) else "Template")
        # validate template_type
        if t not in dict(SlideTemplate.TEMPLATE_TYPE_CHOICES):
            return Response({"error": "Invalid template_type"}, status=400)
        cfg = self._default_config(t)
        ser = self.get_serializer(data={
            "title": title,
            "template_type": t,
            "data": cfg,
        })
        ser.is_valid(raise_exception=True)
        self.perform_create(ser)
        return Response(ser.data, status=201)

    @action(detail=True, methods=['post'], url_path='apply')
    def apply_template(self, request, pk=None):
        template = self.get_object()
        lesson_id = request.data.get('lesson_id')

        if not lesson_id:
            return Response({"error": "lesson_id is required"}, status=400)

        try:
            lesson = Lesson.objects.get(id=lesson_id)
        except Lesson.DoesNotExist:
            return Response({"error": "Lesson not found"}, status=404)

        t = template.template_type
        cfg = template.data or {}

        created_slides = []

        if t == "quiz":
            s = Slide.objects.create(lesson=lesson, title=f"Quiz: {template.title}")
            SlideObject.objects.create(
                slide=s, object_type="text",
                data={"text": cfg.get("question", "")},
                position={"x":80,"y":80,"width":900,"height":60}, z_index=1
            )
            y = 180
            for opt in cfg.get("options", []):
                SlideObject.objects.create(
                    slide=s, object_type="checkbox",
                    data={"label": opt, "correct": (opt == cfg.get("answer"))},
                    position={"x":120,"y":y,"width":600,"height":40}, z_index=1
                )
                y += 60
            created_slides.append(s.id)

        elif t == "matching":
            s = Slide.objects.create(lesson=lesson, title=f"Matching: {template.title}")
            left = cfg.get("left", []); right = cfg.get("right", [])
            y = 120
            SlideObject.objects.create(
                slide=s, object_type="text",
                data={"text": "Match left to right"}, position={"x":80,"y":60,"width":700,"height":40}, z_index=1
            )
            for i in range(max(len(left), len(right))):
                ltxt = left[i] if i < len(left) else ""
                rtxt = right[i] if i < len(right) else ""
                SlideObject.objects.create(slide=s, object_type="text",
                    data={"text": f"{i+1}. {ltxt}"}, position={"x":80,"y":y,"width":400,"height":40}, z_index=1)
                SlideObject.objects.create(slide=s, object_type="text",
                    data={"text": rtxt}, position={"x":600,"y":y,"width":400,"height":40}, z_index=1)
                y += 50
            created_slides.append(s.id)

        elif t == "flashcards":
            cards = cfg.get("cards", [])
            for idx, card in enumerate(cards, start=1):
                s = Slide.objects.create(lesson=lesson, title=f"Card {idx}: {template.title}")
                SlideObject.objects.create(slide=s, object_type="text",
                    data={"text": card.get("front","(front)")},
                    position={"x":100,"y":140,"width":1000,"height":120}, z_index=1)
                SlideObject.objects.create(slide=s, object_type="text",
                    data={"text": card.get("back","(back)"), "color":"#666", "fontSize":22},
                    position={"x":100,"y":320,"width":1000,"height":120}, z_index=1)
                created_slides.append(s.id)

        elif t == "poll":
            s = Slide.objects.create(lesson=lesson, title=f"Poll: {template.title}")
            SlideObject.objects.create(slide=s, object_type="text",
                data={"text": cfg.get("question","Poll")}, position={"x":80,"y":80,"width":900,"height":60}, z_index=1)
            y = 180
            for opt in cfg.get("options", []):
                SlideObject.objects.create(slide=s, object_type="checkbox",
                    data={"label": opt}, position={"x":120,"y":y,"width":600,"height":40}, z_index=1)
                y += 60
            created_slides.append(s.id)

        elif t == "crossword":
            s = Slide.objects.create(lesson=lesson, title=f"Crossword: {template.title}")
            rows = int(cfg.get("rows", 5)); cols = int(cfg.get("cols", 5))
            cellW, cellH = 40, 40; startX, startY = 80, 120
            SlideObject.objects.create(slide=s, object_type="shape",
                data={"shapeType": "rect", "stroke":"#333", "strokeWidth":2, "fill":"transparent"},
                position={"x":startX-4,"y":startY-4,"width":cols*cellW+8,"height":rows*cellH+8}, z_index=0)
            for cell in cfg.get("cells", []):
                r, c = cell.get("r",0), cell.get("c",0)
                letter = cell.get("letter","")
                x = startX + c*cellW + 12
                y = startY + r*cellH + 8
                SlideObject.objects.create(slide=s, object_type="text",
                    data={"text": letter, "fontSize":22},
                    position={"x":x,"y":y,"width":cellW,"height":cellH}, z_index=1)
            created_slides.append(s.id)

        else:
            return Response({"error":"Unsupported template_type"}, status=400)

        return Response({"message": "Template applied", "slides": created_slides}, status=201)


class SlideViewSet(viewsets.ModelViewSet):
    queryset = Slide.objects.select_related('lesson')
    serializer_class = SlideSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['lesson']   # /api/slides/?lesson=1


class SlideObjectViewSet(viewsets.ModelViewSet):
    queryset = SlideObject.objects.select_related('slide')
    serializer_class = SlideObjectSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['slide', 'object_type']  # /api/objects/?slide=ID

    @action(detail=False, methods=['patch'], url_path='batch')
    def batch_update(self, request):
        """
        Body: [{"id": 2, "position": {...}}, {"id": 3, "z_index": 999}, ...]
        """
        items = request.data
        if not isinstance(items, list):
            return Response({"detail": "List expected"}, status=status.HTTP_400_BAD_REQUEST)

        updated = []
        with transaction.atomic():
            for it in items:
                obj_id = it.get("id")
                if not obj_id:
                    return Response({"detail": "Missing id"}, status=status.HTTP_400_BAD_REQUEST)
                try:
                    obj = self.get_queryset().get(pk=obj_id)
                except SlideObject.DoesNotExist:
                    return Response({"detail": f"Object {obj_id} not found"}, status=status.HTTP_404_NOT_FOUND)

                for f in ["position", "z_index", "is_locked", "rotation", "data"]:
                    if f in it:
                        setattr(obj, f, it[f])
                obj.save()
                updated.append(obj_id)

        return Response({"updated": updated}, status=status.HTTP_200_OK)


class SubmissionViewSet(viewsets.ModelViewSet):
    queryset = Submission.objects.select_related('slide', 'template', 'user')
    serializer_class = SubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['slide', 'template', 'user']

    def get_queryset(self):
        base_qs = Submission.objects.select_related('slide', 'template', 'user')
        if getattr(self, 'action', None) in {'list', 'retrieve'}:
            return base_qs.filter(user=self.request.user)
        return base_qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = serializer.save(user=request.user)

        extra_payload = self._process_submission(submission)
        response_serializer = self.get_serializer(submission)
        response_data = dict(response_serializer.data)
        response_data.update(extra_payload)
        headers = self.get_success_headers(response_data)
        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)

    def _process_submission(self, submission: Submission) -> dict:
        template = submission.template
        template_type = template.template_type if template else None
        payload = submission.data or {}
        extra = {}

        if template_type == 'quiz':
            expected = None
            if isinstance(template.data, dict):
                expected = template.data.get('answer')
            answer = payload.get('answer') if isinstance(payload, dict) else None
            correct = False
            if expected is not None and answer is not None:
                if isinstance(expected, str) and isinstance(answer, str):
                    correct = expected.strip().casefold() == answer.strip().casefold()
                else:
                    correct = expected == answer
            submission.score = 1.0 if correct else 0.0
            submission.save(update_fields=['score'])
            extra['correct'] = bool(correct)
        elif template_type == 'poll':
            queryset = self._related_queryset(submission)
            extra['results'] = self._aggregate_poll(queryset, template)

        return extra

    def _related_queryset(self, submission: Submission):
        if submission.template_id:
            return Submission.objects.filter(template_id=submission.template_id)
        if submission.slide_id:
            return Submission.objects.filter(slide_id=submission.slide_id)
        return Submission.objects.none()

    def _aggregate_poll(self, queryset, template: Optional[SlideTemplate]):
        counts = Counter()
        total = 0
        for sub in queryset:
            data = sub.data if isinstance(sub.data, dict) else {}
            answer = data.get('answer')
            if answer is None:
                continue
            key = str(answer)
            counts[key] += 1
            total += 1

        template_options = []
        if template and isinstance(template.data, dict):
            template_options = template.data.get('options') or []

        results = []
        if template_options:
            for option in template_options:
                option_key = str(option)
                count = counts.get(option_key, 0)
                percentage = (count / total * 100.0) if total else 0.0
                results.append({
                    'option': option,
                    'count': count,
                    'percentage': percentage,
                })
        else:
            for option_key, count in counts.items():
                percentage = (count / total * 100.0) if total else 0.0
                results.append({
                    'option': option_key,
                    'count': count,
                    'percentage': percentage,
                })

        return results

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        template_id = request.query_params.get('template')
        slide_id = request.query_params.get('slide')

        if not template_id and not slide_id:
            return Response(
                {'detail': 'Pass either template or slide query parameter.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = Submission.objects.select_related('template').all()
        template_obj = None

        if template_id:
            queryset = queryset.filter(template_id=template_id)
            template_obj = SlideTemplate.objects.filter(pk=template_id).first()

        if slide_id:
            queryset = queryset.filter(slide_id=slide_id)
            if template_obj is None:
                submission_with_template = (
                    queryset.filter(template__isnull=False)
                    .select_related('template')
                    .first()
                )
                if submission_with_template:
                    template_obj = submission_with_template.template

        total = queryset.count()
        template_type = template_obj.template_type if template_obj else None

        if template_type == 'poll':
            results = self._aggregate_poll(queryset, template_obj)
            return Response({
                'type': 'poll',
                'template': template_id,
                'slide': slide_id,
                'total': total,
                'results': results,
            })

        if template_type == 'quiz':
            correct_count = queryset.filter(score__gte=0.999).count()
            percent = (correct_count / total * 100.0) if total else 0.0
            return Response({
                'type': 'quiz',
                'template': template_id,
                'slide': slide_id,
                'total': total,
                'correct': correct_count,
                'correct_percentage': percent,
            })

        return Response({
            'type': template_type or 'generic',
            'template': template_id,
            'slide': slide_id,
            'total': total,
        })
