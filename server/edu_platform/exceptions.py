from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import exception_handler
import traceback


def _view_name(context):
    view = context.get("view")
    if view is None:
        return None
    return view.__class__.__name__


def dev_exception_handler(exc, context):
    """Attach extra debug details to DRF error responses when DEBUG is enabled."""
    response = exception_handler(exc, context)

    if response is None:
        if settings.DEBUG:
            return Response(
                {
                    "detail": str(exc),
                    "exc_type": exc.__class__.__name__,
                    "traceback": traceback.format_exc(),
                    "view": _view_name(context),
                },
                status=500,
            )
        return response

    if settings.DEBUG:
        response.data.setdefault("detail", str(exc))
        response.data["exc_type"] = exc.__class__.__name__
        try:
            response.data["traceback"] = traceback.format_exc()
        except Exception:
            pass
        response.data["view"] = _view_name(context)

    return response
