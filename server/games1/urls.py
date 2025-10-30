from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GameSessionViewSet, PlayerViewSet

router = DefaultRouter()
router.register(r'sessions', GameSessionViewSet)
router.register(r'players', PlayerViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
