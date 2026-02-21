from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    LessonViewSet,
    EnrollmentViewSet,
    AssignmentViewSet,
    SubmissionViewSet,
    RewardViewSet,
    InsightViewSet,
    ExperimentViewSet,
    ExperimentParticipantViewSet,
)

router = DefaultRouter()
router.register(r"lessons", LessonViewSet, basename="lesson")
router.register(r"enrollments", EnrollmentViewSet, basename="enrollment")

# teacher-only
router.register(r"assignments", AssignmentViewSet, basename="assignment")

router.register(r"submissions", SubmissionViewSet, basename="submission")
router.register(r"rewards", RewardViewSet, basename="reward")
router.register(r"insights", InsightViewSet, basename="insight")
router.register(r"experiments", ExperimentViewSet, basename="experiment")
router.register(r"experiment-participants", ExperimentParticipantViewSet, basename="experiment-participant")

# student-only: my tasks


urlpatterns = [
    path("", include(router.urls)),
]
