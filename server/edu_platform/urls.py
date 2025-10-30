from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),

    # JWT endpoints
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Application APIs
    path('api/accounts/', include('accounts.urls')),
    path('api/lessons/', include('lessons.urls')),
    path('api/', include('slide.urls')),
    path('api/games/', include('games1.urls')),

    
    # ⚠️ Бұл жолдар қазір уақытша өшіріледі (app әлі жоқ):
    # path('api/templates/', include('templates.urls')),
    # path('api/submissions/', include('submission.urls')),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
