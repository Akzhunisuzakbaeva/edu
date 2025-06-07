from django.urls import path
from .views import LessonListCreateView

urlpatterns = [
    path('', LessonListCreateView.as_view(), name='lesson-list-create'),
]
