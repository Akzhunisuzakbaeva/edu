from rest_framework import viewsets
from .models import Slide, SlideObject
from .serializers import SlideSerializer, SlideObjectSerializer
from rest_framework.permissions import IsAuthenticated

class SlideViewSet(viewsets.ModelViewSet):
    queryset = Slide.objects.all()
    serializer_class = SlideSerializer
    permission_classes = [IsAuthenticated]

class SlideObjectViewSet(viewsets.ModelViewSet):
    queryset = SlideObject.objects.all()
    serializer_class = SlideObjectSerializer
    permission_classes = [IsAuthenticated]
