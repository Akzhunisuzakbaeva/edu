# server/templates/views.py

from django.shortcuts import get_object_or_404
from rest_framework import generics, status, permissions
from rest_framework.response import Response

from .models import SortingTemplate
from .serializers import SortingTemplateSerializer

# ✅ Slide import
# Егер сенде slide app аты "slide" болса осылай.
# Егер "slides" немесе "slide_app" болса, соған ауыстыр.
from slide.models import Slide


class SortingTemplateListCreateView(generics.ListCreateAPIView):
    serializer_class = SortingTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # ✅ Әр user тек өз шаблондарын көргені дұрыс
        # Егер SortingTemplate моделіңде owner жоқ болса, осы фильтрді алып таста
        return SortingTemplate.objects.filter(owner=self.request.user).order_by("-id")

    def perform_create(self, serializer):
        # ✅ owner өрісі бар болса
        if "owner" in [f.name for f in SortingTemplate._meta.fields]:
            serializer.save(owner=self.request.user)
        else:
            serializer.save()


class SortingTemplateDetailView(generics.RetrieveAPIView):
    serializer_class = SortingTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # ✅ detail де owner бойынша қорғалған болсын
        if "owner" in [f.name for f in SortingTemplate._meta.fields]:
            return SortingTemplate.objects.filter(owner=self.request.user)
        return SortingTemplate.objects.all()


class SortingTemplateApplyView(generics.GenericAPIView):
    """
    POST /api/templates/sorting/<id>/apply/
    Body (optional):
      {
        "lesson_id": 12,
        "title_prefix": "Sorting"
      }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        template = get_object_or_404(SortingTemplate, pk=pk)

        # ✅ Егер owner бар болса: бөтен шаблонға apply жасатпа
        if "owner" in [f.name for f in SortingTemplate._meta.fields]:
            if getattr(template, "owner_id", None) != request.user.id:
                return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        lesson_id = request.data.get("lesson_id")
        title_prefix = request.data.get("title_prefix") or getattr(template, "title", None) or "Sorting"

        slide_kwargs = {}

        # ✅ Егер Slide моделіңде lesson FK бар болса ғана:
        #   slide_kwargs["lesson_id"] = lesson_id
        # Егер сенде өріс аты "lesson" емес "lesson_id" емес, мысалы "lesson_fk" болса, соны қой
        if lesson_id is not None:
            # тексер: Slide моделінде lesson_id бар ма?
            if "lesson" in [f.name for f in Slide._meta.fields]:
                slide_kwargs["lesson_id"] = lesson_id

        created = []
        for i in range(1, 4):
            create_data = {
                "title": f"{title_prefix} {i}",
                **slide_kwargs,
            }

            # ✅ Егер Slide-да owner/author/created_by сияқты өріс болса ғана қос
            slide_fields = [f.name for f in Slide._meta.fields]
            if "owner" in slide_fields:
                create_data["owner"] = request.user
            elif "author" in slide_fields:
                create_data["author"] = request.user
            elif "created_by" in slide_fields:
                create_data["created_by"] = request.user

            s = Slide.objects.create(**create_data)
            created.append({"id": s.id, "title": getattr(s, "title", f"Slide {s.id}")})

        return Response(
            {"template_id": template.id, "created_slides": created},
            status=status.HTTP_201_CREATED,
        )


class SortingTemplatePresetView(generics.CreateAPIView):
    """
    POST /api/templates/sorting/preset/
    Body: { "template_type": "sorting", "title": optional, ...any template fields }
    Returns: created template object
    """
    serializer_class = SortingTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        payload = request.data.copy()

        template_type = payload.get("template_type") or payload.get("type") or "sorting"
        title = payload.get("title") or f"{str(template_type).title()} preset"

        payload["template_type"] = template_type
        payload["title"] = title

        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)

        # ✅ owner бар болса
        if "owner" in [f.name for f in SortingTemplate._meta.fields]:
            serializer.save(owner=request.user)
        else:
            serializer.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)
