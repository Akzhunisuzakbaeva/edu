from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.files import File
from pathlib import Path
from datetime import timedelta
import os
import shutil
import subprocess
import tempfile


class LiveSession(models.Model):
    SOURCE_SLIDES = "slides"
    SOURCE_CANVA = "canva"
    SOURCE_URL = "url"
    SOURCE_PPTX = "pptx"
    SOURCE_CHOICES = (
        (SOURCE_SLIDES, "Slides"),
        (SOURCE_CANVA, "Canva"),
        (SOURCE_URL, "External URL"),
        (SOURCE_PPTX, "PPTX"),
    )

    lesson = models.ForeignKey(
        "lessons.Lesson",
        on_delete=models.CASCADE,
        related_name="live_sessions",
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="live_sessions",
    )

    is_active = models.BooleanField(default=True)
    current_slide_index = models.IntegerField(default=0)
    live_code = models.CharField(max_length=8, blank=True, default="", db_index=True)

    source_type = models.CharField(
        max_length=16,
        choices=SOURCE_CHOICES,
        default=SOURCE_SLIDES,
    )
    canva_embed_url = models.URLField(blank=True, default="")
    external_view_url = models.URLField(blank=True, default="")
    pptx_file = models.FileField(upload_to="live/pptx/", blank=True, null=True)
    pptx_preview_pdf = models.FileField(
        upload_to="live/pptx_preview/",
        blank=True,
        null=True,
    )
    timer_duration_seconds = models.PositiveIntegerField(default=0)
    timer_started_at = models.DateTimeField(null=True, blank=True)
    timer_ends_at = models.DateTimeField(null=True, blank=True)

    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"Live: lesson_id={self.lesson_id} teacher_id={self.teacher_id}"

    def end(self):
        self.is_active = False
        self.ended_at = timezone.now()
        self.timer_started_at = None
        self.timer_ends_at = None
        self.save(
            update_fields=[
                "is_active",
                "ended_at",
                "timer_started_at",
                "timer_ends_at",
            ]
        )

    @property
    def timer_is_running(self):
        if not self.is_active or not self.timer_ends_at:
            return False
        return self.timer_ends_at > timezone.now()

    @property
    def timer_remaining_seconds(self):
        if not self.timer_ends_at:
            return 0
        remaining = int((self.timer_ends_at - timezone.now()).total_seconds())
        return max(0, remaining)

    def start_timer(self, duration_seconds: int):
        now = timezone.now()
        self.timer_duration_seconds = max(0, int(duration_seconds or 0))
        self.timer_started_at = now
        if self.timer_duration_seconds > 0:
            self.timer_ends_at = now + timedelta(seconds=self.timer_duration_seconds)
        else:
            self.timer_ends_at = None
        self.save(
            update_fields=[
                "timer_duration_seconds",
                "timer_started_at",
                "timer_ends_at",
            ]
        )

    def stop_timer(self):
        self.timer_started_at = None
        self.timer_ends_at = None
        self.save(update_fields=["timer_started_at", "timer_ends_at"])

    def generate_pptx_preview_pdf(self):
        """
        PPTX-ты PDF-ке конверттеп, браузер/телефонда inline көруге мүмкіндік береді.
        LibreOffice (soffice) жоқ болса немесе конверт сәтсіз болса, жай ғана False қайтарады.
        """
        if not self.pptx_file:
            return False

        source_path = getattr(self.pptx_file, "path", "")
        if not source_path or not os.path.exists(source_path):
            return False

        temp_dir = tempfile.mkdtemp(prefix="live_pptx_")
        try:
            subprocess.run(
                [
                    "soffice",
                    "--headless",
                    "--convert-to",
                    "pdf:impress_pdf_Export",
                    "--outdir",
                    temp_dir,
                    source_path,
                ],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )

            expected_pdf = Path(temp_dir) / (Path(source_path).stem + ".pdf")
            if not expected_pdf.exists():
                return False

            output_name = f"{Path(self.pptx_file.name).stem}.pdf"
            with expected_pdf.open("rb") as fh:
                self.pptx_preview_pdf.save(output_name, File(fh), save=False)
            self.save(update_fields=["pptx_preview_pdf"])
            return True
        except Exception:
            return False
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)


class LiveParticipant(models.Model):
    live_session = models.ForeignKey(
        "live.LiveSession",
        on_delete=models.CASCADE,
        related_name="participants",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="live_participations",
    )
    display_name = models.CharField(max_length=120, blank=True, default="")

    points = models.IntegerField(default=0)
    streak = models.IntegerField(default=0)
    best_streak = models.IntegerField(default=0)
    checkins_count = models.PositiveIntegerField(default=0)

    current_slide_index = models.IntegerField(default=0)
    last_checked_slide_index = models.IntegerField(default=-1)

    joined_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("live_session", "student")
        ordering = ["-points", "-best_streak", "joined_at", "id"]

    def __str__(self):
        return f"LiveParticipant<{self.live_session_id}:{self.student_id}:{self.points}>"

    @property
    def resolved_name(self):
        return self.display_name or self.student.full_name or self.student.username


class LiveSlideCheckin(models.Model):
    live_session = models.ForeignKey(
        "live.LiveSession",
        on_delete=models.CASCADE,
        related_name="slide_checkins",
    )
    participant = models.ForeignKey(
        "live.LiveParticipant",
        on_delete=models.CASCADE,
        related_name="slide_checkins",
    )
    slide_index = models.PositiveIntegerField(default=0)
    reaction_ms = models.PositiveIntegerField(default=0)
    points_awarded = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("participant", "slide_index")
        ordering = ["live_session_id", "slide_index", "created_at", "id"]
        indexes = [
            models.Index(fields=["live_session", "slide_index"]),
            models.Index(fields=["participant", "slide_index"]),
        ]

    def __str__(self):
        return (
            f"Checkin<live={self.live_session_id}, student={self.participant_id}, "
            f"slide={self.slide_index}, points={self.points_awarded}>"
        )
