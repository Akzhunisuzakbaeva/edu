from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    AdaptiveRuleViewSet,
    CreateStudentView,
    MeView,
    MyTokenObtainPairView,
    RegisterView,
    StudentProfileDetailView,
    StudentProfileMeView,
)

router = DefaultRouter()
router.register(r"auth/adaptive-rules", AdaptiveRuleViewSet, basename="adaptive-rule")

urlpatterns = [
    path("auth/register/", RegisterView.as_view()),
    path("auth/create-student/", CreateStudentView.as_view()),
    path("auth/login/", MyTokenObtainPairView.as_view()),
    path("auth/refresh/", TokenRefreshView.as_view()),
    path("auth/me/", MeView.as_view()),
    path("auth/profile/", StudentProfileMeView.as_view()),
    path("auth/profile/<int:student_id>/", StudentProfileDetailView.as_view()),
    path("", include(router.urls)),
]
