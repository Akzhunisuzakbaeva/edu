import api from "../api/axios";

export type LiveSourceType = "slides" | "canva" | "url" | "pptx";

export type LiveParticipantDto = {
  id: number;
  student: number;
  username?: string;
  full_name?: string;
  display_name?: string;
  name?: string;
  points: number;
  streak: number;
  best_streak: number;
  checkins_count: number;
  current_slide_index: number;
  joined_at: string;
  last_seen_at: string;
  is_online: boolean;
};

export type LiveSessionDto = {
  id: number;
  lesson: number;
  lesson_title?: string;
  teacher: number;
  is_active: boolean;
  current_slide_index: number;
  live_code?: string;
  source_type: LiveSourceType;
  canva_embed_url?: string;
  external_view_url?: string;
  pptx_file?: string | null;
  pptx_preview_pdf?: string | null;
  pptx_file_url?: string;
  pptx_preview_url?: string;
  content_url?: string;
  timer_duration_seconds?: number;
  timer_started_at?: string | null;
  timer_ends_at?: string | null;
  timer_is_running?: boolean;
  timer_remaining_seconds?: number;
  participants_online?: number;
  started_at: string;
  ended_at?: string | null;
};

export type LiveSlideObjectDto = {
  id: number;
  object_type: string;
  data: any;
  position: { x?: number; y?: number; width?: number; height?: number };
  z_index?: number;
};

export type LiveCurrentSlideDto = {
  slide_index: number;
  total_slides: number;
  slide: { id: number; title?: string } | null;
  objects: LiveSlideObjectDto[];
};

export const startLive = (payload: FormData) =>
  api.post<LiveSessionDto>("/live/sessions/start/", payload, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const endLive = (liveId: number) =>
  api.post<LiveSessionDto>(`/live/sessions/${liveId}/end/`);

export const setSlide = (liveId: number, slideIndex: number) =>
  api.post<LiveSessionDto>(`/live/sessions/${liveId}/set-slide/`, {
    slide_index: slideIndex,
  });

export const startLiveTimer = (liveId: number, durationSeconds: number) =>
  api.post<LiveSessionDto>(`/live/sessions/${liveId}/timer/start/`, {
    duration_seconds: durationSeconds,
  });

export const stopLiveTimer = (liveId: number) =>
  api.post<LiveSessionDto>(`/live/sessions/${liveId}/timer/stop/`);

export const joinLive = (liveId: number, displayName?: string) =>
  api.post<{ participant: LiveParticipantDto; leaderboard: LiveParticipantDto[] }>(
    `/live/sessions/${liveId}/join/`,
    displayName ? { display_name: displayName } : {}
  );

export const liveHeartbeat = (liveId: number, currentSlideIndex?: number) =>
  api.post<{ ok: boolean; participant: LiveParticipantDto }>(
    `/live/sessions/${liveId}/heartbeat/`,
    typeof currentSlideIndex === "number"
      ? { current_slide_index: currentSlideIndex }
      : {}
  );

export const getLiveCurrentSlide = (liveId: number) =>
  api.get<LiveCurrentSlideDto>(`/live/sessions/${liveId}/current-slide/`);

export const submitLiveCheckin = (
  liveId: number,
  slideIndex: number,
  reactionMs: number,
  answerData?: Record<string, any>
) =>
  api.post<{
    awarded_points: number;
    rank: number | null;
    is_correct: boolean;
    is_answerable: boolean;
    detail?: string;
    participant: LiveParticipantDto;
    leaderboard: LiveParticipantDto[];
  }>(`/live/sessions/${liveId}/checkin/`, {
    slide_index: slideIndex,
    reaction_ms: reactionMs,
    answer_data: answerData || {},
  });

export const getLiveLeaderboard = (liveId: number) =>
  api.get<{ leaderboard: LiveParticipantDto[] }>(`/live/sessions/${liveId}/leaderboard/`);

export const getLiveParticipants = (liveId: number) =>
  api.get<{ participants: LiveParticipantDto[] }>(`/live/sessions/${liveId}/participants/`);

export const getActiveLives = () =>
  api.get<LiveSessionDto[]>("/live/sessions/active/");

export const getLiveByCode = (code: string) =>
  api.get<LiveSessionDto>(
    `/live/sessions/by-code/${encodeURIComponent((code || "").trim().toUpperCase())}/`
  );
