from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponseRedirect
from django.urls import include, path

urlpatterns = [
    path("", lambda request: HttpResponseRedirect(settings.FRONTEND_URL)),
    path("admin/", admin.site.urls),

    # Apps
    path("api/", include("quiz.urls")),
    path("api/", include("users.urls")),        # ішінде /auth/login/ бар
    path("api/lessons/", include("lessons.urls")),
    path("api/slide/", include("slide.urls")),
    path("api/templates/", include("templates.urls")),
    path("api/games/", include("games1.urls")),
    path("api/live/", include("live.urls")),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
