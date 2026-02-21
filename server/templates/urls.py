from django.urls import path
from .views import (
    SortingTemplateListCreateView,
    SortingTemplateDetailView,
    SortingTemplateApplyView,
    SortingTemplatePresetView,
)

urlpatterns = [
    path("", SortingTemplateListCreateView.as_view()),
    path("preset/", SortingTemplatePresetView.as_view()),
    path("<int:pk>/", SortingTemplateDetailView.as_view()),
    path("<int:pk>/apply/", SortingTemplateApplyView.as_view()),
]
