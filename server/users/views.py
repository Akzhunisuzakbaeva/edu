from rest_framework import generics, permissions, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from django.http import Http404
from .serializers import (
    AdaptiveRuleSerializer,
    CreateStudentSerializer,
    MeSerializer,
    MyTokenObtainPairSerializer,
    RegisterSerializer,
    StudentProfileSerializer,
)
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import AdaptiveRule, StudentProfile, User
from lessons.adaptive import recompute_student_profile
from lessons.models import Enrollment


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class MeView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MeSerializer

    def get_object(self):
        return self.request.user


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


class CreateStudentView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CreateStudentSerializer

    def perform_create(self, serializer):
        if getattr(self.request.user, "role", None) != "teacher":
            raise PermissionDenied("Only teachers can create students.")
        serializer.save()


class StudentProfileMeView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StudentProfileSerializer

    def get_object(self):
        if getattr(self.request.user, "role", None) != "student":
            raise PermissionDenied("Only students have editable profile.")
        profile, _ = StudentProfile.objects.get_or_create(student=self.request.user)
        return profile

    def retrieve(self, request, *args, **kwargs):
        refresh = str(request.query_params.get("refresh", "")).lower() in {"1", "true", "yes"}
        if refresh and getattr(request.user, "role", None) == "student":
            recompute_student_profile(request.user)
        return super().retrieve(request, *args, **kwargs)


class StudentProfileDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StudentProfileSerializer

    def get_object(self):
        if getattr(self.request.user, "role", None) != "teacher":
            raise PermissionDenied("Only teachers can view student profile.")

        student_id = self.kwargs.get("student_id")
        student = User.objects.filter(id=student_id, role="student").first()
        if not student:
            raise Http404("Student not found.")

        allowed = Enrollment.objects.filter(student=student, lesson__owner=self.request.user).exists()
        if not allowed:
            raise PermissionDenied("Student is not in your lessons.")

        recompute_student_profile(student)
        profile, _ = StudentProfile.objects.get_or_create(student=student)
        return profile


class AdaptiveRuleViewSet(viewsets.ModelViewSet):
    serializer_class = AdaptiveRuleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self.request.user, "role", None) != "teacher":
            raise PermissionDenied("Only teachers can manage adaptive rules.")
        return AdaptiveRule.objects.all().order_by("min_success_rate", "id")

    def create(self, request, *args, **kwargs):
        if getattr(request.user, "role", None) != "teacher":
            raise PermissionDenied("Only teachers can manage adaptive rules.")
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if getattr(request.user, "role", None) != "teacher":
            raise PermissionDenied("Only teachers can manage adaptive rules.")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if getattr(request.user, "role", None) != "teacher":
            raise PermissionDenied("Only teachers can manage adaptive rules.")
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if getattr(request.user, "role", None) != "teacher":
            raise PermissionDenied("Only teachers can manage adaptive rules.")
        return super().destroy(request, *args, **kwargs)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
