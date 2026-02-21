# slide/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .health import echo, health
from .views import (
    SlideObjectViewSet,
    SlideTemplateViewSet,
    SlideViewSet,
    SubmissionViewSet,
)

router = DefaultRouter()
router.register(r'templates', SlideTemplateViewSet, basename='template')
router.register(r'objects', SlideObjectViewSet, basename='slideobject')
router.register(r'slides', SlideViewSet, basename='slides')
router.register(r'submissions', SubmissionViewSet, basename='submission')

urlpatterns = [
    path('health/', health),
    path('echo/', echo),
    path('', include(router.urls)),
    
]
