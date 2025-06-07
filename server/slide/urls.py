from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SlideViewSet, SlideObjectViewSet

router = DefaultRouter()
router.register(r'slides', SlideViewSet, basename='slide')
router.register(r'slide-objects', SlideObjectViewSet, basename='slideobject')

urlpatterns = [
    path('', include(router.urls)),
]
