from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health(request):
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def echo(request):
    return Response({"received": request.data})
