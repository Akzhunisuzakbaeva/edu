from rest_framework import viewsets
from .models import Quiz
from .serializers import QuizSerializer, QuizCreateSerializer

class QuizViewSet(viewsets.ModelViewSet):
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer

    def get_serializer_class(self):
        if self.action == "create":
            return QuizCreateSerializer
        return QuizSerializer
