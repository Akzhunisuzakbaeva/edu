import random
import string
from typing import Optional, Tuple, List

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, permissions, generics
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from lessons.models import Lesson
from slide.models import Slide, SlideObject
from .models import LiveSession, LiveParticipant, LiveSlideCheckin
from .serializers import (
    LiveSessionSerializer,
    LiveParticipantSerializer,
    StartLiveSessionSerializer,
    SlideUpdateSerializer,
    JoinLiveSerializer,
    HeartbeatSerializer,
    SlideCheckinSerializer,
    LiveTimerSerializer,
)

CLEAR_CODE_TRANSLATION = str.maketrans(
    {
        "А": "A",
        "В": "B",
        "С": "C",
        "Е": "E",
        "Н": "H",
        "К": "K",
        "М": "M",
        "О": "O",
        "Р": "P",
        "Т": "T",
        "У": "Y",
        "Х": "X",
        "І": "I",
    }
)


def _require_teacher(user):
    if getattr(user, "role", None) != "teacher":
        raise PermissionDenied("Тек мұғалім live сабақты басқара алады.")


def _generate_live_code():
    alphabet = string.ascii_uppercase.replace("O", "") + "23456789"
    for _ in range(20):
        code = "".join(random.choice(alphabet) for _ in range(6))
        if not LiveSession.objects.filter(is_active=True, live_code=code).exists():
            return code
    return "".join(random.choice(alphabet) for _ in range(8))


def _normalize_live_code(value: str) -> str:
    raw = (value or "").strip().upper().translate(CLEAR_CODE_TRANSLATION)
    return "".join(ch for ch in raw if ch.isalnum())


class StartLiveSessionView(APIView):
    """
    POST /api/live/sessions/start/
    body: { "lesson_id": 1 }
    """

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        _require_teacher(request.user)
        serializer = StartLiveSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lesson_id = serializer.validated_data["lesson_id"]
        lesson = get_object_or_404(Lesson, id=lesson_id, owner=request.user)

        # Бұрынғы active live-тарды жабамыз
        LiveSession.objects.filter(
            lesson=lesson,
            teacher=request.user,
            is_active=True,
        ).update(is_active=False, ended_at=timezone.now())

        source_type = serializer.validated_data.get("source_type", LiveSession.SOURCE_SLIDES)
        live = LiveSession.objects.create(
            lesson=lesson,
            teacher=request.user,
            is_active=True,
            live_code=_generate_live_code(),
            source_type=source_type,
            canva_embed_url=(
                serializer.validated_data.get("canva_embed_url", "")
                if source_type == LiveSession.SOURCE_CANVA
                else ""
            ),
            external_view_url=(
                serializer.validated_data.get("external_view_url", "")
                if source_type == LiveSession.SOURCE_URL
                else ""
            ),
            pptx_file=(
                serializer.validated_data.get("pptx_file")
                if source_type == LiveSession.SOURCE_PPTX
                else None
            ),
        )

        if source_type == LiveSession.SOURCE_PPTX and live.pptx_file:
            live.generate_pptx_preview_pdf()

        return Response(
            LiveSessionSerializer(live, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class EndLiveSessionView(APIView):
    """
    POST /api/live/sessions/<pk>/end/
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        _require_teacher(request.user)
        live = get_object_or_404(LiveSession, pk=pk, teacher=request.user)

        if not live.is_active:
            return Response(
                {"detail": "Бұл live бұрыннан аяқталған."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        live.end()
        return Response(LiveSessionSerializer(live, context={"request": request}).data)


class UpdateSlideIndexView(APIView):
    """
    POST /api/live/sessions/<pk>/set-slide/
    body: { "slide_index": 3 }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        _require_teacher(request.user)
        live = get_object_or_404(
            LiveSession,
            pk=pk,
            teacher=request.user,
            is_active=True,
        )

        serializer = SlideUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        live.current_slide_index = serializer.validated_data["slide_index"]
        live.save(update_fields=["current_slide_index"])

        return Response(LiveSessionSerializer(live, context={"request": request}).data)


class LiveSessionByCodeView(APIView):
    """
    GET /api/live/sessions/by-code/<code>/
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, code):
        normalized = _normalize_live_code(code)
        live = (
            LiveSession.objects.select_related("lesson", "teacher")
            .filter(is_active=True, live_code__iexact=normalized)
            .first()
        )
        if not live:
            return Response({"detail": "Тірі сабақ табылмады."}, status=status.HTTP_404_NOT_FOUND)
        if live.source_type == LiveSession.SOURCE_PPTX and live.pptx_file and not live.pptx_preview_pdf:
            live.generate_pptx_preview_pdf()
            live.refresh_from_db(fields=["pptx_preview_pdf"])
        return Response(LiveSessionSerializer(live, context={"request": request}).data)


class ActiveLiveSessionsView(generics.ListAPIView):
    """
    GET /api/live/sessions/active/
    Студенттер жақтан "қазір қандай live бар?" деп көру үшін.
    """

    serializer_class = LiveSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return LiveSession.objects.filter(is_active=True).select_related("lesson", "teacher")


def _leaderboard_data(live: LiveSession, limit: Optional[int] = 20):
    qs = live.participants.select_related("student").order_by("-points", "-best_streak", "joined_at", "id")
    if limit:
        qs = qs[:limit]
    return LiveParticipantSerializer(qs, many=True).data


def _upsert_participant(live: LiveSession, user, display_name: str = ""):
    participant, _ = LiveParticipant.objects.get_or_create(
        live_session=live,
        student=user,
        defaults={
            "display_name": (display_name or "").strip(),
            "current_slide_index": live.current_slide_index,
        },
    )
    updated_fields = []
    if display_name and display_name.strip() and participant.display_name != display_name.strip():
        participant.display_name = display_name.strip()
        updated_fields.append("display_name")
    if participant.current_slide_index < live.current_slide_index:
        participant.current_slide_index = live.current_slide_index
        updated_fields.append("current_slide_index")
    if updated_fields:
        updated_fields.append("last_seen_at")
        participant.save(update_fields=updated_fields)
    else:
        participant.save(update_fields=["last_seen_at"])
    return participant


def _live_slide_at_index(live: LiveSession, slide_index: Optional[int] = None) -> Tuple[Optional[Slide], int, int]:
    slides = list(
        Slide.objects.filter(lesson=live.lesson)
        .only("id", "title", "order")
        .order_by("order", "id")
    )
    total = len(slides)
    if total == 0:
        return None, 0, 0
    idx = slide_index if slide_index is not None else live.current_slide_index
    idx = max(0, min(int(idx), total - 1))
    return slides[idx], idx, total


def _slide_objects_payload(slide: Slide) -> List[dict]:
    objects = (
        SlideObject.objects.filter(slide=slide)
        .only("id", "object_type", "data", "position", "z_index")
        .order_by("z_index", "id")
    )
    return [
        {
            "id": obj.id,
            "object_type": obj.object_type,
            "data": obj.data or {},
            "position": obj.position or {},
            "z_index": obj.z_index or 0,
        }
        for obj in objects
    ]


def _evaluate_slide_answer(slide: Slide, answer_data: dict) -> Tuple[bool, bool, str]:
    checkbox_objects = list(
        SlideObject.objects.filter(slide=slide, object_type=SlideObject.CHECKBOX).only("id", "data")
    )
    if not checkbox_objects:
        return False, False, "Бұл слайдта бағаланатын жауап жоқ."

    correct_ids = sorted(
        obj.id for obj in checkbox_objects if bool((obj.data or {}).get("correct"))
    )
    if not correct_ids:
        return False, False, "Бұл слайдта дұрыс жауап белгіленбеген."

    raw_selected = answer_data.get("selected_object_ids")
    if not isinstance(raw_selected, list):
        raw_selected = []

    allowed_ids = {obj.id for obj in checkbox_objects}
    selected_ids = []
    for item in raw_selected:
        try:
            parsed = int(item)
        except (TypeError, ValueError):
            continue
        if parsed in allowed_ids:
            selected_ids.append(parsed)
    selected_ids = sorted(set(selected_ids))

    is_correct = selected_ids == correct_ids
    if is_correct:
        return True, True, "Дұрыс жауап. Ұпай қосылды."
    return True, False, "Қате жауап. Ұпай қосылмайды."


class JoinLiveSessionView(APIView):
    """
    POST /api/live/sessions/<pk>/join/
    body: { "display_name": "Aruzhan" }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        live = get_object_or_404(LiveSession, pk=pk, is_active=True)
        serializer = JoinLiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        participant = _upsert_participant(
            live,
            request.user,
            serializer.validated_data.get("display_name", ""),
        )
        return Response(
            {
                "participant": LiveParticipantSerializer(participant).data,
                "leaderboard": _leaderboard_data(live, limit=12),
            }
        )


class LiveHeartbeatView(APIView):
    """
    POST /api/live/sessions/<pk>/heartbeat/
    body: { "current_slide_index": 2 }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        live = get_object_or_404(LiveSession, pk=pk, is_active=True)
        serializer = HeartbeatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        participant = _upsert_participant(live, request.user)
        fields_to_update = ["last_seen_at"]
        next_slide = serializer.validated_data.get("current_slide_index")
        if next_slide is not None:
            participant.current_slide_index = max(0, int(next_slide))
            fields_to_update.append("current_slide_index")
        participant.save(update_fields=list(set(fields_to_update)))
        return Response(
            {
                "ok": True,
                "participant": LiveParticipantSerializer(participant).data,
            }
        )


class LiveCurrentSlideView(APIView):
    """
    GET /api/live/sessions/<pk>/current-slide/
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        live = get_object_or_404(LiveSession, pk=pk, is_active=True)
        if request.user.id != live.teacher_id:
            _upsert_participant(live, request.user)

        slide, safe_index, total = _live_slide_at_index(live)
        if not slide:
            return Response(
                {
                    "slide_index": 0,
                    "total_slides": 0,
                    "slide": None,
                    "objects": [],
                }
            )

        return Response(
            {
                "slide_index": safe_index,
                "total_slides": total,
                "slide": {"id": slide.id, "title": slide.title},
                "objects": _slide_objects_payload(slide),
            }
        )


class LiveSlideCheckinView(APIView):
    """
    POST /api/live/sessions/<pk>/checkin/
    body: { "slide_index": 3, "reaction_ms": 1800 }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        live = get_object_or_404(LiveSession, pk=pk, is_active=True)
        serializer = SlideCheckinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        slide_index = serializer.validated_data["slide_index"]
        reaction_ms = serializer.validated_data.get("reaction_ms", 0)
        answer_data = serializer.validated_data.get("answer_data") or {}
        participant = _upsert_participant(live, request.user)

        existing = LiveSlideCheckin.objects.filter(
            participant=participant,
            slide_index=slide_index,
        ).first()
        if existing:
            return Response(
                {
                    "awarded_points": 0,
                    "rank": None,
                    "is_correct": False,
                    "is_answerable": True,
                    "detail": "Бұл слайд үшін чек-ин бұрын жіберілген.",
                    "participant": LiveParticipantSerializer(participant).data,
                    "leaderboard": _leaderboard_data(live, limit=12),
                },
                status=status.HTTP_200_OK,
            )

        if live.source_type != LiveSession.SOURCE_SLIDES:
            return Response(
                {
                    "awarded_points": 0,
                    "rank": None,
                    "is_correct": False,
                    "is_answerable": False,
                    "detail": "Ұпай есептеу тек Slides режиміндегі сұрақтарда жұмыс істейді.",
                    "participant": LiveParticipantSerializer(participant).data,
                    "leaderboard": _leaderboard_data(live, limit=12),
                },
                status=status.HTTP_200_OK,
            )

        current_slide, safe_index, _ = _live_slide_at_index(live)
        if not current_slide:
            return Response(
                {
                    "awarded_points": 0,
                    "rank": None,
                    "is_correct": False,
                    "is_answerable": False,
                    "detail": "Бұл live сабақта слайд табылмады.",
                    "participant": LiveParticipantSerializer(participant).data,
                    "leaderboard": _leaderboard_data(live, limit=12),
                },
                status=status.HTTP_200_OK,
            )
        if slide_index != safe_index:
            return Response(
                {
                    "awarded_points": 0,
                    "rank": None,
                    "is_correct": False,
                    "is_answerable": False,
                    "detail": "Мұғалім басқа слайдқа ауысты. Қайта жауап беріңіз.",
                    "participant": LiveParticipantSerializer(participant).data,
                    "leaderboard": _leaderboard_data(live, limit=12),
                },
                status=status.HTTP_200_OK,
            )

        is_answerable, is_correct, answer_detail = _evaluate_slide_answer(current_slide, answer_data)
        if not is_answerable:
            return Response(
                {
                    "awarded_points": 0,
                    "rank": None,
                    "is_correct": False,
                    "is_answerable": False,
                    "detail": answer_detail,
                    "participant": LiveParticipantSerializer(participant).data,
                    "leaderboard": _leaderboard_data(live, limit=12),
                },
                status=status.HTTP_200_OK,
            )

        rank = None
        base_points = 30
        if is_correct:
            rank = (
                LiveSlideCheckin.objects.filter(
                    live_session=live,
                    slide_index=slide_index,
                    points_awarded__gt=0,
                ).count()
                + 1
            )
            if rank == 1:
                base_points = 100
            elif rank == 2:
                base_points = 70
            elif rank == 3:
                base_points = 50

        time_factor = 1.0
        if live.timer_duration_seconds > 0 and live.timer_started_at and live.timer_ends_at:
            if live.timer_remaining_seconds <= 0:
                time_factor = 0.0
            else:
                time_factor = max(0.3, live.timer_remaining_seconds / float(live.timer_duration_seconds))

        awarded = max(0, int(round(base_points * time_factor))) if is_correct else 0

        LiveSlideCheckin.objects.create(
            live_session=live,
            participant=participant,
            slide_index=slide_index,
            reaction_ms=reaction_ms,
            points_awarded=awarded,
        )

        if is_correct:
            if participant.last_checked_slide_index + 1 == slide_index:
                participant.streak += 1
            else:
                participant.streak = 1
        else:
            participant.streak = 0
        participant.best_streak = max(participant.best_streak, participant.streak)
        participant.last_checked_slide_index = slide_index
        participant.current_slide_index = max(participant.current_slide_index, slide_index)
        participant.checkins_count += 1
        participant.points += awarded
        participant.save(
            update_fields=[
                "streak",
                "best_streak",
                "last_checked_slide_index",
                "current_slide_index",
                "checkins_count",
                "points",
                "last_seen_at",
            ]
        )

        return Response(
            {
                "awarded_points": awarded,
                "rank": rank,
                "is_correct": bool(is_correct),
                "is_answerable": True,
                "detail": answer_detail,
                "participant": LiveParticipantSerializer(participant).data,
                "leaderboard": _leaderboard_data(live, limit=12),
            },
            status=status.HTTP_201_CREATED,
        )


class LiveLeaderboardView(APIView):
    """
    GET /api/live/sessions/<pk>/leaderboard/
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        live = get_object_or_404(LiveSession, pk=pk, is_active=True)
        return Response({"leaderboard": _leaderboard_data(live, limit=20)})


class LiveParticipantsView(APIView):
    """
    GET /api/live/sessions/<pk>/participants/
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        live = get_object_or_404(LiveSession, pk=pk, is_active=True)
        _require_teacher(request.user)
        data = LiveParticipantSerializer(
            live.participants.select_related("student").order_by("-last_seen_at", "-points", "id"),
            many=True,
        ).data
        return Response({"participants": data})


class StartLiveTimerView(APIView):
    """
    POST /api/live/sessions/<pk>/timer/start/
    body: { "duration_seconds": 60 }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        _require_teacher(request.user)
        live = get_object_or_404(LiveSession, pk=pk, teacher=request.user, is_active=True)
        serializer = LiveTimerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        live.start_timer(serializer.validated_data["duration_seconds"])
        return Response(LiveSessionSerializer(live, context={"request": request}).data)


class StopLiveTimerView(APIView):
    """
    POST /api/live/sessions/<pk>/timer/stop/
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        _require_teacher(request.user)
        live = get_object_or_404(LiveSession, pk=pk, teacher=request.user, is_active=True)
        live.stop_timer()
        return Response(LiveSessionSerializer(live, context={"request": request}).data)
