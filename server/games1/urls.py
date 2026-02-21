# games1/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GameSessionViewSet, PlayerViewSet

router = DefaultRouter()
router.register(r"sessions", GameSessionViewSet, basename="game-session")
router.register(r"players", PlayerViewSet, basename="player")

urlpatterns = [
    path("", include(router.urls)),
]
