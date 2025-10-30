from rest_framework import viewsets
from .models import GameSession, Player
from .serializers import GameSessionSerializer, PlayerSerializer

class GameSessionViewSet(viewsets.ModelViewSet):
    queryset = GameSession.objects.all()
    serializer_class = GameSessionSerializer


class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
