from django.urls import path
from .views import (
    StartLiveSessionView,
    EndLiveSessionView,
    UpdateSlideIndexView,
    ActiveLiveSessionsView,
    LiveSessionByCodeView,
    JoinLiveSessionView,
    LiveHeartbeatView,
    LiveCurrentSlideView,
    LiveSlideCheckinView,
    LiveLeaderboardView,
    LiveParticipantsView,
    StartLiveTimerView,
    StopLiveTimerView,
)

urlpatterns = [
    path("sessions/start/", StartLiveSessionView.as_view(), name="live-start"),
    path("sessions/<int:pk>/end/", EndLiveSessionView.as_view(), name="live-end"),
    path("sessions/<int:pk>/set-slide/", UpdateSlideIndexView.as_view(), name="live-set-slide"),
    path("sessions/<int:pk>/join/", JoinLiveSessionView.as_view(), name="live-join"),
    path("sessions/<int:pk>/heartbeat/", LiveHeartbeatView.as_view(), name="live-heartbeat"),
    path("sessions/<int:pk>/current-slide/", LiveCurrentSlideView.as_view(), name="live-current-slide"),
    path("sessions/<int:pk>/checkin/", LiveSlideCheckinView.as_view(), name="live-checkin"),
    path("sessions/<int:pk>/leaderboard/", LiveLeaderboardView.as_view(), name="live-leaderboard"),
    path("sessions/<int:pk>/participants/", LiveParticipantsView.as_view(), name="live-participants"),
    path("sessions/<int:pk>/timer/start/", StartLiveTimerView.as_view(), name="live-timer-start"),
    path("sessions/<int:pk>/timer/stop/", StopLiveTimerView.as_view(), name="live-timer-stop"),
    path("sessions/active/", ActiveLiveSessionsView.as_view(), name="live-active"),
    path("sessions/by-code/<str:code>/", LiveSessionByCodeView.as_view(), name="live-by-code"),
]
