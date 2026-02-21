# server/slide/views.py
from collections import Counter
from typing import Optional
from datetime import datetime, time
import re
import zipfile
from xml.etree import ElementTree

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime, parse_date

from .models import Slide, SlideObject, SlideTemplate, Submission
from .serializers import (
    SlideSerializer,
    SlideObjectSerializer,
    SlideTemplateSerializer,
    SubmissionSerializer,
)
from lessons.models import Assignment, Lesson
from lessons.adaptive import recompute_student_profile


QUESTION_RE = re.compile(r"^(?:сұрақ\s*)?(\d+)\s*[\)\.\:\-]\s*(.+)$", re.IGNORECASE)
OPTION_RE = re.compile(r"^([A-DА-Г])\s*[\)\.\:\-]\s*(.+)$", re.IGNORECASE)
CORRECT_RE = re.compile(
    r"^(?:дұрыс\s*жауап|жауап|correct\s*answer|answer)\s*[:\-]\s*(.+)$",
    re.IGNORECASE,
)
OPTION_INLINE_RE = re.compile(r"([A-DА-Г])\s*[\)\.]\s*", re.IGNORECASE)
CORRECT_ANY_RE = re.compile(
    r"(?:дұрыс\s*жауап|жауап|correct\s*answer|answer)\s*[:\-]\s*([A-DА-Г]|.+)$",
    re.IGNORECASE,
)


def _normalize_option_label(label: str) -> str:
    raw = (label or "").upper()
    mapping = {
        "А": "A",
        "Б": "B",
        "В": "C",
        "Г": "D",
    }
    return mapping.get(raw, raw)


def _extract_docx_paragraphs(uploaded_file):
    filename = (getattr(uploaded_file, "name", "") or "").lower()
    if not filename.endswith(".docx"):
        raise ValueError("Тек .docx файл жүктеңіз.")

    try:
        uploaded_file.seek(0)
    except Exception:
        pass

    try:
        with zipfile.ZipFile(uploaded_file) as zf:
            xml_bytes = zf.read("word/document.xml")
    except Exception:
        raise ValueError("DOCX файлын оқу мүмкін болмады.")

    try:
        root = ElementTree.fromstring(xml_bytes)
    except Exception:
        raise ValueError("DOCX құрылымы жарамсыз.")

    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []
    for p in root.findall(".//w:body/w:p", ns):
        text_parts = []
        for t in p.findall(".//w:t", ns):
            text_parts.append(t.text or "")
        line = "".join(text_parts).strip()
        if line:
            paragraphs.append(line)
    return paragraphs


def _resolve_answer(current):
    options = current.get("options", [])
    answer_label = current.get("answer_label")
    answer_text = (current.get("answer_text") or "").strip()

    if answer_label:
        for o in options:
            if o.get("label") == answer_label:
                return o.get("text", "").strip()

    if answer_text:
        normalized = answer_text.lower().strip()
        if len(normalized) == 1:
            letter = _normalize_option_label(normalized)
            for o in options:
                if o.get("label") == letter:
                    return o.get("text", "").strip()
        for o in options:
            if o.get("text", "").strip().lower() == normalized:
                return o.get("text", "").strip()

    for o in options:
        text = (o.get("text") or "").strip()
        if text.startswith("*"):
            return text.lstrip("*").strip()

    return (options[0].get("text") or "").strip() if options else ""


def _parse_docx_quiz_questions(lines):
    questions = []
    warnings = []
    current = None

    def parse_inline_question(raw_line: str):
        raw = (raw_line or "").strip()
        if not raw or "?" not in raw:
            return None

        correct_match = CORRECT_ANY_RE.search(raw)
        if correct_match:
            body = raw[:correct_match.start()].strip()
            answer_token = (correct_match.group(1) or "").strip()
        else:
            body = raw
            answer_token = ""

        option_matches = list(OPTION_INLINE_RE.finditer(body))
        if len(option_matches) < 2:
            return None

        question_text = body[: option_matches[0].start()].strip()
        if not question_text:
            return None

        options = []
        for idx, match in enumerate(option_matches):
            start = match.end()
            end = option_matches[idx + 1].start() if idx + 1 < len(option_matches) else len(body)
            opt_text = body[start:end].strip()
            if not opt_text:
                continue
            options.append(
                {
                    "label": _normalize_option_label(match.group(1)),
                    "text": opt_text.lstrip("*").strip(),
                }
            )

        if len(options) < 2:
            return None

        answer = _resolve_answer(
            {
                "options": options,
                "answer_label": _normalize_option_label(answer_token) if len(answer_token) == 1 else "",
                "answer_text": answer_token if len(answer_token) != 1 else "",
            }
        )
        if not answer:
            answer = options[0]["text"]

        return {
            "question": question_text,
            "options": [o["text"] for o in options],
            "answer": answer,
        }

    def push_current():
        nonlocal current
        if not current:
            return
        q_text = (current.get("question") or "").strip()
        opts = []
        seen = set()
        for opt in current.get("options", []):
            txt = (opt.get("text") or "").strip()
            if not txt:
                continue
            if txt in seen:
                continue
            seen.add(txt)
            opts.append({"label": opt.get("label", ""), "text": txt.lstrip("*").strip()})

        if not q_text or len(opts) < 2:
            warnings.append(f"Сұрақ өткізіліп кетті: {q_text[:60] or '(бос)'}")
            current = None
            return

        answer = _resolve_answer({**current, "options": opts})
        if not answer:
            answer = opts[0]["text"]

        questions.append(
            {
                "question": q_text,
                "options": [o["text"] for o in opts],
                "answer": answer,
            }
        )
        current = None

    for line in lines:
        raw = (line or "").strip()
        if not raw:
            continue

        inline = parse_inline_question(raw)
        if inline:
            push_current()
            questions.append(inline)
            continue

        q_match = QUESTION_RE.match(raw)
        if q_match:
            push_current()
            current = {
                "question": q_match.group(2).strip(),
                "options": [],
                "answer_label": "",
                "answer_text": "",
            }
            continue

        if current is None:
            if "?" in raw:
                current = {
                    "question": raw,
                    "options": [],
                    "answer_label": "",
                    "answer_text": "",
                }
            continue

        opt_match = OPTION_RE.match(raw)
        if opt_match:
            label = _normalize_option_label(opt_match.group(1))
            text = opt_match.group(2).strip()
            current["options"].append({"label": label, "text": text})
            continue

        correct_match = CORRECT_RE.match(raw)
        if correct_match:
            token = correct_match.group(1).strip()
            if len(token) == 1:
                current["answer_label"] = _normalize_option_label(token)
            else:
                current["answer_text"] = token
            continue

        # continue question/options multi-line
        if current["options"]:
            current["options"][-1]["text"] = f"{current['options'][-1]['text']} {raw}".strip()
        else:
            current["question"] = f"{current['question']} {raw}".strip()

    push_current()
    return questions, warnings


class SlideTemplateViewSet(viewsets.ModelViewSet):
    queryset = SlideTemplate.objects.all()
    serializer_class = SlideTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        role = getattr(self.request.user, "role", None)
        if role == "teacher":
            return SlideTemplate.objects.filter(author=self.request.user)
        if role == "student":
            template_ids = (
                Assignment.objects.filter(is_published=True, content_id__isnull=False)
                .filter(
                    Q(assignees__student=self.request.user)
                    | Q(lesson__enrollments__student=self.request.user)
                )
                .values_list("content_id", flat=True)
            )
            return SlideTemplate.objects.filter(id__in=template_ids).distinct()
        return SlideTemplate.objects.none()

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=False, methods=['post'], url_path='import-docx-quiz')
    def import_docx_quiz(self, request):
        if getattr(request.user, "role", None) != "teacher":
            raise PermissionDenied("Тек мұғалім импорт жасай алады.")

        uploaded_file = request.FILES.get("file")
        base_title = (request.data.get("title") or "Word Quiz").strip()
        mode = (request.data.get("mode") or "separate").strip().lower()
        if not uploaded_file:
            return Response({"error": "file міндетті"}, status=400)
        if mode not in {"separate", "single_quiz"}:
            return Response({"error": "mode мәні separate немесе single_quiz болуы керек."}, status=400)

        try:
            lines = _extract_docx_paragraphs(uploaded_file)
            parsed_questions, warnings = _parse_docx_quiz_questions(lines)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=400)

        if not parsed_questions:
            return Response(
                {
                    "error": (
                        "DOCX ішінен сұрақ табылмады. Формат мысалы: "
                        "1) ... A) ... B) ... C) ... Дұрыс жауап: A"
                    )
                },
                status=400,
            )

        created = []
        with transaction.atomic():
            if mode == "single_quiz":
                first = parsed_questions[0]
                tpl = SlideTemplate.objects.create(
                    title=base_title,
                    author=request.user,
                    template_type="quiz",
                    data={
                        # backward compatibility for old renderers
                        "question": first["question"],
                        "options": first["options"],
                        "answer": first["answer"],
                        # new multi-question format
                        "questions": parsed_questions,
                    },
                )
                created.append({"id": tpl.id, "title": tpl.title})
            else:
                for idx, q in enumerate(parsed_questions, start=1):
                    tpl = SlideTemplate.objects.create(
                        title=f"{base_title} · {idx}",
                        author=request.user,
                        template_type="quiz",
                        data={
                            "question": q["question"],
                            "options": q["options"],
                            "answer": q["answer"],
                        },
                    )
                    created.append({"id": tpl.id, "title": tpl.title})

        return Response(
            {
                "mode": mode,
                "created_count": len(created),
                "created": created,
                "warnings": warnings[:20],
                "questions_detected": len(parsed_questions),
            },
            status=status.HTTP_201_CREATED,
        )

    def _default_config(self, t: str):
        if t == "quiz":
            return {
                "question": "Primary Key не үшін керек?",
                "options": [
                    "Жазбаны бірегей анықтау үшін",
                    "Кестені жою үшін",
                    "Тек индексті сақтау үшін",
                    "SQL синтаксисін тексеру үшін",
                ],
                "answer": "Жазбаны бірегей анықтау үшін",
            }
        if t == "matching":
            return {
                "left": [
                    "SELECT",
                    "INSERT",
                    "UPDATE",
                    "DELETE",
                ],
                "right": [
                    "Деректерді оқу",
                    "Жазба қосу",
                    "Жазбаны өзгерту",
                    "Жазбаны жою",
                ],
            }
        if t == "flashcards":
            return {
                "cards": [
                    {
                        "front": "Primary Key",
                        "back": "Жазбаны бірегей анықтайтын өріс.",
                    },
                    {
                        "front": "Foreign Key",
                        "back": "Басқа кестеге сілтеме.",
                    },
                    {
                        "front": "Index",
                        "back": "Іздеуді жылдамдататын құрылым.",
                    },
                ]
            }
        if t == "poll":
            return {
                "question": "Қай SQL командасын жиі қолданасыз?",
                "options": [
                    "SELECT",
                    "INSERT",
                    "UPDATE",
                    "DELETE",
                ],
            }
        if t == "crossword":
            return {
                "rows": 10,
                "cols": 10,
                "cells": [
                    {"r": 1, "c": 4, "letter": "D"},
                    {"r": 2, "c": 4, "letter": "A"},
                    {"r": 3, "c": 4, "letter": "T"},
                    {"r": 4, "c": 4, "letter": "A"},
                    {"r": 5, "c": 4, "letter": "B"},
                    {"r": 6, "c": 4, "letter": "A"},
                    {"r": 7, "c": 4, "letter": "S"},
                    {"r": 8, "c": 4, "letter": "E"},

                    {"r": 1, "c": 2, "letter": "I"},
                    {"r": 1, "c": 3, "letter": "N"},
                    {"r": 1, "c": 5, "letter": "E"},
                    {"r": 1, "c": 6, "letter": "X"},

                    {"r": 2, "c": 3, "letter": "T"},
                    {"r": 2, "c": 5, "letter": "B"},
                    {"r": 2, "c": 6, "letter": "L"},
                    {"r": 2, "c": 7, "letter": "E"},

                    {"r": 3, "c": 5, "letter": "Y"},
                    {"r": 3, "c": 6, "letter": "P"},
                    {"r": 3, "c": 7, "letter": "E"},

                    {"r": 4, "c": 0, "letter": "P"},
                    {"r": 4, "c": 1, "letter": "R"},
                    {"r": 4, "c": 2, "letter": "I"},
                    {"r": 4, "c": 3, "letter": "M"},
                    {"r": 4, "c": 5, "letter": "R"},
                    {"r": 4, "c": 6, "letter": "Y"},

                    {"r": 5, "c": 5, "letter": "L"},
                    {"r": 5, "c": 6, "letter": "O"},
                    {"r": 5, "c": 7, "letter": "B"},

                    {"r": 6, "c": 3, "letter": "C"},
                    {"r": 6, "c": 5, "letter": "C"},
                    {"r": 6, "c": 6, "letter": "H"},
                    {"r": 6, "c": 7, "letter": "E"},

                    {"r": 7, "c": 5, "letter": "Q"},
                    {"r": 7, "c": 6, "letter": "L"},

                    {"r": 8, "c": 3, "letter": "K"},
                    {"r": 8, "c": 5, "letter": "Y"},
                ],
                "clues": {
                    "across": [
                        "1) INDEX - дерек іздеуді жылдамдататын құрылым",
                        "2) TABLE - кесте",
                        "3) TYPE - дерек типі",
                        "4) PRIMARY - негізгі кілт (Primary Key басы)",
                        "5) BLOB - үлкен бинарлық объект",
                        "6) CACHE - жылдам уақытша сақтау аймағы",
                        "7) SQL - сұраныс тілі",
                        "8) KEY - кілт",
                    ],
                    "down": [
                        "1) DATABASE - дерекқор",
                    ],
                },
            }
        if t == "sorting":
            return {
                "items": [
                    "1) Кестені таңдау",
                    "2) SELECT өрістерін жазу",
                    "3) WHERE шартын қосу",
                    "4) Сұранысты орындау",
                ]
            }
        if t == "grouping":
            return {
                "groups": [
                    {
                        "title": "Кесте құрылымы",
                        "items": ["Баған (Column)", "Жол (Row)", "Өріс типі (Type)"],
                    },
                    {
                        "title": "SQL әрекеттері",
                        "items": ["SELECT — оқу", "INSERT — қосу", "UPDATE — өзгерту"],
                    },
                ]
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
        if lesson.owner_id != request.user.id:
            return Response({"error": "Forbidden"}, status=403)

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
            created_slides.append({"id": s.id, "title": s.title})

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
            created_slides.append({"id": s.id, "title": s.title})

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
                created_slides.append({"id": s.id, "title": s.title})

        elif t == "poll":
            s = Slide.objects.create(lesson=lesson, title=f"Poll: {template.title}")
            SlideObject.objects.create(slide=s, object_type="text",
                data={"text": cfg.get("question","Poll")}, position={"x":80,"y":80,"width":900,"height":60}, z_index=1)
            y = 180
            for opt in cfg.get("options", []):
                SlideObject.objects.create(slide=s, object_type="checkbox",
                    data={"label": opt}, position={"x":120,"y":y,"width":600,"height":40}, z_index=1)
                y += 60
            created_slides.append({"id": s.id, "title": s.title})

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
            created_slides.append({"id": s.id, "title": s.title})

        elif t == "sorting":
            s = Slide.objects.create(lesson=lesson, title=f"Sorting: {template.title}")
            SlideObject.objects.create(
                slide=s, object_type="text",
                data={"text": "Қадамдарды дұрыс ретпен орналастырыңыз"},
                position={"x":80,"y":60,"width":900,"height":40}, z_index=1
            )
            y = 140
            for item in cfg.get("items", []):
                SlideObject.objects.create(
                    slide=s, object_type="text",
                    data={"text": item},
                    position={"x":120,"y":y,"width":800,"height":40}, z_index=1
                )
                y += 55
            created_slides.append({"id": s.id, "title": s.title})

        elif t == "grouping":
            s = Slide.objects.create(lesson=lesson, title=f"Grouping: {template.title}")
            SlideObject.objects.create(
                slide=s, object_type="text",
                data={"text": "Элементтерді тиісті топтарға бөліңіз"},
                position={"x":80,"y":60,"width":900,"height":40}, z_index=1
            )
            groups = cfg.get("groups", [])
            x = 80
            for g in groups[:3]:
                SlideObject.objects.create(
                    slide=s, object_type="text",
                    data={"text": g.get("title", "Топ")},
                    position={"x":x,"y":120,"width":280,"height":30}, z_index=1
                )
                y = 170
                for it in g.get("items", [])[:5]:
                    SlideObject.objects.create(
                        slide=s, object_type="text",
                        data={"text": it},
                        position={"x":x,"y":y,"width":280,"height":30}, z_index=1
                    )
                    y += 40
                x += 320
            created_slides.append({"id": s.id, "title": s.title})

        else:
            return Response({"error":"Unsupported template_type"}, status=400)

        return Response(
            {
                "template_id": template.id,
                "created_slides": created_slides,
            },
            status=201,
        )


class SlideViewSet(viewsets.ModelViewSet):
    queryset = Slide.objects.select_related('lesson')
    serializer_class = SlideSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['lesson']   # /api/slides/?lesson=1
    def get_queryset(self):
        qs = super().get_queryset().filter(lesson__owner=self.request.user)
        slide = self.request.query_params.get("slide")
        if slide:
            qs = qs.filter(slide_id=slide)
        return qs


class SlideObjectViewSet(viewsets.ModelViewSet):
    queryset = SlideObject.objects.select_related('slide')
    serializer_class = SlideObjectSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['slide', 'object_type']  # /api/objects/?slide=ID
    def get_queryset(self):
        return super().get_queryset().filter(slide__lesson__owner=self.request.user)

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
        adaptive_feedback = recompute_student_profile(request.user)
        response_serializer = self.get_serializer(submission)
        response_data = dict(response_serializer.data)
        response_data.update(extra_payload)
        response_data["adaptive_feedback"] = adaptive_feedback
        headers = self.get_success_headers(response_data)
        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)

    def _process_submission(self, submission: Submission) -> dict:
        template = submission.template
        template_type = template.template_type if template else None
        payload = submission.data or {}
        extra = {}

        def _same_answer(a, b):
            if a is None or b is None:
                return False
            if isinstance(a, str) and isinstance(b, str):
                return a.strip().casefold() == b.strip().casefold()
            return a == b

        if template_type == 'quiz':
            cfg = template.data if isinstance(template.data, dict) else {}
            questions = cfg.get('questions') if isinstance(cfg.get('questions'), list) else None

            if questions:
                answers = payload.get('answers') if isinstance(payload, dict) else None
                if not isinstance(answers, list):
                    single = payload.get('answer') if isinstance(payload, dict) else None
                    answers = [single] if single is not None else []

                total = 0
                correct_count = 0
                details = []
                for idx, question in enumerate(questions):
                    if not isinstance(question, dict):
                        continue
                    expected = question.get('answer')
                    if expected is None:
                        continue
                    total += 1
                    given = answers[idx] if idx < len(answers) else None
                    is_ok = _same_answer(expected, given)
                    if is_ok:
                        correct_count += 1
                    details.append(
                        {
                            "index": idx + 1,
                            "question": question.get("question", ""),
                            "given": given,
                            "expected": expected,
                            "correct": bool(is_ok),
                        }
                    )

                submission.score = (correct_count / total) if total else 0.0
                submission.save(update_fields=['score'])
                extra['correct'] = bool(total and correct_count == total)
                extra['correct_count'] = correct_count
                extra['total_questions'] = total
                extra['details'] = details
            else:
                expected = cfg.get('answer')
                answer = payload.get('answer') if isinstance(payload, dict) else None
                correct = _same_answer(expected, answer)
                submission.score = 1.0 if correct else 0.0
                submission.save(update_fields=['score'])
                extra['correct'] = bool(correct)
        elif template_type == 'poll':
            queryset = self._related_queryset(submission)
            extra['results'] = self._aggregate_poll(queryset, template)
        elif template_type == 'sorting':
            expected = []
            if isinstance(template.data, dict):
                expected = template.data.get('items') or []
            given = payload.get('order') if isinstance(payload, dict) else None
            correct = bool(expected) and isinstance(given, list) and given == expected
            submission.score = 1.0 if correct else 0.0
            submission.save(update_fields=['score'])
            extra['correct'] = bool(correct)
        elif template_type == 'matching':
            left = []
            right = []
            if isinstance(template.data, dict):
                left = template.data.get('left') or []
                right = template.data.get('right') or []
            pairs = payload.get('pairs') if isinstance(payload, dict) else None
            correct = False
            if isinstance(pairs, dict) and left and right and len(left) == len(right):
                correct = all(pairs.get(l) == right[i] for i, l in enumerate(left))
            submission.score = 1.0 if correct else 0.0
            submission.save(update_fields=['score'])
            extra['correct'] = bool(correct)
        elif template_type == 'grouping':
            groups = []
            if isinstance(template.data, dict):
                groups = template.data.get('groups') or []
            submitted = payload.get('groups') if isinstance(payload, dict) else None
            correct = False
            if isinstance(submitted, dict) and groups:
                correct = True
                for g in groups:
                    title = g.get('title')
                    items = g.get('items') or []
                    if title is None or not isinstance(items, list):
                        correct = False
                        break
                    got = submitted.get(title)
                    if not isinstance(got, list) or sorted(got) != sorted(items):
                        correct = False
                        break
            submission.score = 1.0 if correct else 0.0
            submission.save(update_fields=['score'])
            extra['correct'] = bool(correct)
        elif template_type == 'flashcards':
            correct = bool(payload.get('correct')) if isinstance(payload, dict) else False
            submission.score = 1.0 if correct else 0.0
            submission.save(update_fields=['score'])
            extra['correct'] = bool(correct)
        elif template_type == 'crossword':
            cfg = template.data or {}
            expected = {}
            for cell in cfg.get('cells', []) or []:
                r = cell.get('r'); c = cell.get('c')
                if r is None or c is None:
                    continue
                expected[f"{r},{c}"] = str(cell.get('letter', '')).strip().upper()
            submitted_cells = payload.get('cells') if isinstance(payload, dict) else None
            correct = 0
            total = len(expected)
            if isinstance(submitted_cells, list) and total:
                for cell in submitted_cells:
                    r = cell.get('r'); c = cell.get('c')
                    key = f"{r},{c}"
                    if key in expected:
                        letter = str(cell.get('letter', '')).strip().upper()
                        if letter == expected[key]:
                            correct += 1
            submission.score = (correct / total) if total else 0.0
            submission.save(update_fields=['score'])
            extra['correct'] = bool(total and correct == total)

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
        date_from = request.query_params.get('from')
        date_to = request.query_params.get('to')

        if not template_id and not slide_id:
            return Response(
                {'detail': 'Pass either template or slide query parameter.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = Submission.objects.select_related('template').all()
        if date_from:
            dt = parse_datetime(date_from) or parse_date(date_from)
            if isinstance(dt, datetime):
                if timezone.is_naive(dt):
                    dt = timezone.make_aware(dt, timezone.get_current_timezone())
                queryset = queryset.filter(created_at__gte=dt)
            elif dt:
                start = timezone.make_aware(datetime.combine(dt, time.min), timezone.get_current_timezone())
                queryset = queryset.filter(created_at__gte=start)
        if date_to:
            dt = parse_datetime(date_to) or parse_date(date_to)
            if isinstance(dt, datetime):
                if timezone.is_naive(dt):
                    dt = timezone.make_aware(dt, timezone.get_current_timezone())
                queryset = queryset.filter(created_at__lte=dt)
            elif dt:
                end = timezone.make_aware(datetime.combine(dt, time.max), timezone.get_current_timezone())
                queryset = queryset.filter(created_at__lte=end)
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

        if template_type in {'matching', 'sorting', 'grouping'}:
            counts = Counter()
            for sub in queryset:
                payload = sub.data if isinstance(sub.data, dict) else {}
                key = str(payload)
                counts[key] += 1
            results = []
            for key, count in counts.most_common():
                percentage = (count / total * 100.0) if total else 0.0
                results.append({
                    'value': key,
                    'count': count,
                    'percentage': percentage,
                })
            correct_count = queryset.filter(score__gte=0.999).count()
            correct_percentage = (correct_count / total * 100.0) if total else 0.0
            return Response({
                'type': template_type,
                'template': template_id,
                'slide': slide_id,
                'total': total,
                'correct': correct_count,
                'correct_percentage': correct_percentage,
                'results': results,
            })

        return Response({
            'type': template_type or 'generic',
            'template': template_id,
            'slide': slide_id,
            'total': total,
        })

    @action(detail=False, methods=['get'], url_path='mistakes')
    def mistakes(self, request):
        template_id = request.query_params.get('template')
        slide_id = request.query_params.get('slide')
        date_from = request.query_params.get('from')
        date_to = request.query_params.get('to')

        if not template_id and not slide_id:
            return Response(
                {'detail': 'Pass either template or slide query parameter.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = Submission.objects.select_related('template').all()
        template_obj = None

        if date_from:
            dt = parse_datetime(date_from) or parse_date(date_from)
            if isinstance(dt, datetime):
                if timezone.is_naive(dt):
                    dt = timezone.make_aware(dt, timezone.get_current_timezone())
                queryset = queryset.filter(created_at__gte=dt)
            elif dt:
                start = timezone.make_aware(datetime.combine(dt, time.min), timezone.get_current_timezone())
                queryset = queryset.filter(created_at__gte=start)
        if date_to:
            dt = parse_datetime(date_to) or parse_date(date_to)
            if isinstance(dt, datetime):
                if timezone.is_naive(dt):
                    dt = timezone.make_aware(dt, timezone.get_current_timezone())
                queryset = queryset.filter(created_at__lte=dt)
            elif dt:
                end = timezone.make_aware(datetime.combine(dt, time.max), timezone.get_current_timezone())
                queryset = queryset.filter(created_at__lte=end)

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

        if not template_obj:
            return Response({
                'detail': 'Template not found.',
            }, status=status.HTTP_400_BAD_REQUEST)

        t = template_obj.template_type
        cfg = template_obj.data or {}

        # Quiz mistakes
        if t == 'quiz':
            questions = cfg.get('questions') if isinstance(cfg.get('questions'), list) else None
            if questions:
                rows = []
                overall_total = 0
                overall_wrong = Counter()

                for idx, q in enumerate(questions):
                    if not isinstance(q, dict):
                        continue
                    q_text = q.get('question', f"Question {idx + 1}")
                    correct_answer = q.get('answer', '')
                    wrong_counts = Counter()
                    total = 0

                    for sub in queryset:
                        payload = sub.data if isinstance(sub.data, dict) else {}
                        answers = payload.get('answers')
                        if isinstance(answers, list):
                            answer = answers[idx] if idx < len(answers) else None
                        else:
                            answer = payload.get('answer') if idx == 0 else None
                        if answer is None:
                            continue
                        total += 1
                        overall_total += 1
                        if str(answer).strip().casefold() != str(correct_answer).strip().casefold():
                            txt = str(answer)
                            wrong_counts[txt] += 1
                            overall_wrong[txt] += 1

                    wrong = []
                    for opt, count in wrong_counts.most_common():
                        wrong.append({
                            'answer': opt,
                            'count': count,
                            'percentage': (count / total * 100.0) if total else 0.0,
                        })

                    rows.append(
                        {
                            'index': idx + 1,
                            'question': q_text,
                            'correct_answer': correct_answer,
                            'total': total,
                            'wrong': wrong,
                        }
                    )

                overall_wrong_rows = []
                for opt, count in overall_wrong.most_common():
                    overall_wrong_rows.append({
                        'answer': opt,
                        'count': count,
                        'percentage': (count / overall_total * 100.0) if overall_total else 0.0,
                    })

                first_question = rows[0]['question'] if rows else ''
                first_correct = rows[0]['correct_answer'] if rows else ''
                return Response({
                    'type': 'quiz',
                    'mode': 'multi',
                    'template': template_id,
                    'slide': slide_id,
                    # backward-compatible fields
                    'question': first_question,
                    'correct_answer': first_correct,
                    'total': overall_total,
                    'wrong': overall_wrong_rows,
                    # detailed multi-question mistakes
                    'rows': rows,
                })

            question = cfg.get('question', '')
            correct_answer = cfg.get('answer', '')
            wrong_counts = Counter()
            total = 0
            for sub in queryset:
                payload = sub.data if isinstance(sub.data, dict) else {}
                answer = payload.get('answer')
                if answer is None:
                    continue
                total += 1
                if str(answer).strip().casefold() != str(correct_answer).strip().casefold():
                    wrong_counts[str(answer)] += 1
            results = []
            for opt, count in wrong_counts.most_common():
                percentage = (count / total * 100.0) if total else 0.0
                results.append({
                    'answer': opt,
                    'count': count,
                    'percentage': percentage,
                })
            return Response({
                'type': 'quiz',
                'mode': 'single',
                'template': template_id,
                'slide': slide_id,
                'question': question,
                'correct_answer': correct_answer,
                'total': total,
                'wrong': results,
            })

        # Poll stats (no "correct", show distribution)
        if t == 'poll':
            results = self._aggregate_poll(queryset, template_obj)
            return Response({
                'type': 'poll',
                'template': template_id,
                'slide': slide_id,
                'total': queryset.count(),
                'results': results,
            })

        # Matching mistakes
        if t == 'matching':
            left = cfg.get('left') or []
            right = cfg.get('right') or []
            per_left = {}
            for i, l in enumerate(left):
                per_left[l] = {'correct': right[i] if i < len(right) else None, 'counts': Counter(), 'total': 0}
            for sub in queryset:
                payload = sub.data if isinstance(sub.data, dict) else {}
                pairs = payload.get('pairs') if isinstance(payload, dict) else None
                if not isinstance(pairs, dict):
                    continue
                for l, meta in per_left.items():
                    chosen = pairs.get(l)
                    if chosen is None:
                        continue
                    meta['total'] += 1
                    if chosen != meta['correct']:
                        meta['counts'][str(chosen)] += 1
            rows = []
            for l, meta in per_left.items():
                total = meta['total']
                wrongs = []
                for opt, count in meta['counts'].most_common():
                    wrongs.append({
                        'answer': opt,
                        'count': count,
                        'percentage': (count / total * 100.0) if total else 0.0,
                    })
                rows.append({
                    'left': l,
                    'correct': meta['correct'],
                    'wrong': wrongs,
                })
            return Response({
                'type': 'matching',
                'template': template_id,
                'slide': slide_id,
                'rows': rows,
            })

        # Sorting mistakes (position errors)
        if t == 'sorting':
            expected = cfg.get('items') or []
            pos_counts = []
            for i, exp in enumerate(expected):
                pos_counts.append({'index': i, 'correct': exp, 'counts': Counter(), 'total': 0})
            for sub in queryset:
                payload = sub.data if isinstance(sub.data, dict) else {}
                order = payload.get('order') if isinstance(payload, dict) else None
                if not isinstance(order, list):
                    continue
                for i, meta in enumerate(pos_counts):
                    if i >= len(order):
                        continue
                    meta['total'] += 1
                    if order[i] != meta['correct']:
                        meta['counts'][str(order[i])] += 1
            rows = []
            for meta in pos_counts:
                total = meta['total']
                wrongs = []
                for opt, count in meta['counts'].most_common():
                    wrongs.append({
                        'answer': opt,
                        'count': count,
                        'percentage': (count / total * 100.0) if total else 0.0,
                    })
                rows.append({
                    'index': meta['index'],
                    'correct': meta['correct'],
                    'wrong': wrongs,
                })
            return Response({
                'type': 'sorting',
                'template': template_id,
                'slide': slide_id,
                'rows': rows,
            })

        # Grouping mistakes (wrong group per item)
        if t == 'grouping':
            groups = cfg.get('groups') or []
            expected_map = {}
            for g in groups:
                title = g.get('title')
                for item in g.get('items') or []:
                    expected_map[str(item)] = str(title)
            item_stats = {item: Counter() for item in expected_map.keys()}
            item_total = Counter()
            for sub in queryset:
                payload = sub.data if isinstance(sub.data, dict) else {}
                submitted = payload.get('groups') if isinstance(payload, dict) else None
                if not isinstance(submitted, dict):
                    continue
                seen = set()
                for group_title, items in submitted.items():
                    if not isinstance(items, list):
                        continue
                    for item in items:
                        item = str(item)
                        seen.add(item)
                        item_total[item] += 1
                        if expected_map.get(item) != str(group_title):
                            item_stats[item][str(group_title)] += 1
                for item in expected_map.keys():
                    if item not in seen:
                        item_total[item] += 1
                        item_stats[item]['(missing)'] += 1
            rows = []
            for item, expected_group in expected_map.items():
                total = item_total[item]
                wrongs = []
                for grp, count in item_stats[item].most_common():
                    wrongs.append({
                        'answer': grp,
                        'count': count,
                        'percentage': (count / total * 100.0) if total else 0.0,
                    })
                rows.append({
                    'item': item,
                    'expected': expected_group,
                    'wrong': wrongs,
                })
            return Response({
                'type': 'grouping',
                'template': template_id,
                'slide': slide_id,
                'rows': rows,
            })

        if t == 'flashcards':
            cards = cfg.get('cards') or []
            rows = []
            for i, card in enumerate(cards):
                rows.append({
                    'index': i,
                    'front': card.get('front', ''),
                    'back': card.get('back', ''),
                    'counts': Counter(),
                    'total': 0,
                })
            for sub in queryset:
                payload = sub.data if isinstance(sub.data, dict) else {}
                idx = payload.get('card_index')
                if idx is None:
                    continue
                try:
                    idx = int(idx)
                except (TypeError, ValueError):
                    continue
                if idx < 0 or idx >= len(rows):
                    continue
                rows[idx]['total'] += 1
                if not payload.get('correct'):
                    rows[idx]['counts']['(қате)'] += 1
            out = []
            for row in rows:
                total = row['total']
                wrongs = []
                for opt, count in row['counts'].most_common():
                    wrongs.append({
                        'answer': opt,
                        'count': count,
                        'percentage': (count / total * 100.0) if total else 0.0,
                    })
                out.append({
                    'index': row['index'],
                    'front': row['front'],
                    'back': row['back'],
                    'wrong': wrongs,
                })
            return Response({
                'type': 'flashcards',
                'template': template_id,
                'slide': slide_id,
                'rows': out,
            })

        if t == 'crossword':
            expected = {}
            for cell in cfg.get('cells', []) or []:
                r = cell.get('r'); c = cell.get('c')
                if r is None or c is None:
                    continue
                key = f"{r},{c}"
                expected[key] = str(cell.get('letter', '')).strip().upper()
            stats = {k: {'expected': v, 'counts': Counter(), 'total': 0} for k, v in expected.items()}
            for sub in queryset:
                payload = sub.data if isinstance(sub.data, dict) else {}
                submitted_cells = payload.get('cells') if isinstance(payload, dict) else None
                if not isinstance(submitted_cells, list):
                    continue
                submitted_map = {}
                for cell in submitted_cells:
                    r = cell.get('r'); c = cell.get('c')
                    if r is None or c is None:
                        continue
                    submitted_map[f"{r},{c}"] = str(cell.get('letter', '')).strip().upper()
                for key, meta in stats.items():
                    meta['total'] += 1
                    given = submitted_map.get(key, "")
                    if given != meta['expected']:
                        meta['counts'][given if given else '(blank)'] += 1
            rows = []
            for key, meta in stats.items():
                total = meta['total']
                wrongs = []
                for opt, count in meta['counts'].most_common():
                    wrongs.append({
                        'answer': opt,
                        'count': count,
                        'percentage': (count / total * 100.0) if total else 0.0,
                    })
                r, c = key.split(",")
                rows.append({
                    'cell': {'r': int(r), 'c': int(c)},
                    'expected': meta['expected'],
                    'wrong': wrongs,
                })
            return Response({
                'type': 'crossword',
                'template': template_id,
                'slide': slide_id,
                'rows': rows,
            })

        return Response({
            'detail': 'Mistakes not supported for this template type yet.',
            'type': t,
        }, status=status.HTTP_400_BAD_REQUEST)
