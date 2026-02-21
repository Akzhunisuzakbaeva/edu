import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import {
  endLive,
  getLiveLeaderboard,
  getLiveParticipants,
  LiveParticipantDto,
  LiveSessionDto,
  LiveSourceType,
  startLiveTimer,
  setSlide,
  startLive,
  stopLiveTimer,
} from "../../services/live";

type LessonOption = { id: number; title: string };

const SOURCE_OPTIONS: Array<{ value: LiveSourceType; label: string }> = [
  { value: "slides", label: "Editor slide-тары" },
  { value: "canva", label: "Canva embed" },
  { value: "pptx", label: "PPTX файл" },
  { value: "url", label: "Сыртқы сілтеме" },
];

function toData<T>(value: T | { data: T }): T {
  return (value as { data?: T })?.data ?? (value as T);
}

function getStudentJoinUrl(code?: string) {
  if (!code) return "";
  const base = window.location.origin;
  return `${base}/student/live?code=${encodeURIComponent(code)}`;
}

function getTimerRemainingSeconds(live?: LiveSessionDto | null) {
  if (!live?.timer_ends_at) return 0;
  const ends = new Date(live.timer_ends_at).getTime();
  return Math.max(0, Math.ceil((ends - Date.now()) / 1000));
}

export default function TeacherLivePage() {
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [lessonId, setLessonId] = useState<number | null>(null);

  const [sourceType, setSourceType] = useState<LiveSourceType>("slides");
  const [canvaUrl, setCanvaUrl] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [pptxFile, setPptxFile] = useState<File | null>(null);

  const [live, setLive] = useState<LiveSessionDto | null>(null);
  const [leaderboard, setLeaderboard] = useState<LiveParticipantDto[]>([]);
  const [participants, setParticipants] = useState<LiveParticipantDto[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [timerPreset, setTimerPreset] = useState(60);
  const [timerLoading, setTimerLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadLessons = async () => {
      try {
        const res = await api.get("/lessons/lessons/");
        const list = toData<any[]>(res) || [];
        setLessons(list.map((item) => ({ id: Number(item.id), title: item.title || `Lesson ${item.id}` })));
        if (list.length) {
          setLessonId(Number(list[0].id));
        }
      } catch (e) {
        console.error(e);
        setError("Сабақ тізімін жүктеу мүмкін болмады.");
      }
    };
    loadLessons();
  }, []);

  const canStart = useMemo(() => {
    if (!lessonId) return false;
    if (sourceType === "canva") return Boolean(canvaUrl.trim());
    if (sourceType === "url") return Boolean(externalUrl.trim());
    if (sourceType === "pptx") return Boolean(pptxFile);
    return true;
  }, [lessonId, sourceType, canvaUrl, externalUrl, pptxFile]);

  const contentUrl = live?.content_url?.trim() || "";
  const pptxFileUrl = live?.pptx_file_url?.trim() || "";
  const pptxPreviewUrl = live?.pptx_preview_url?.trim() || "";
  const joinUrl = getStudentJoinUrl(live?.live_code);
  const qrUrl = joinUrl
    ? `https://quickchart.io/qr?size=190&text=${encodeURIComponent(joinUrl)}`
    : "";
  const timerRemainingSeconds = getTimerRemainingSeconds(live);
  const timerRunning = Boolean(live?.timer_is_running && timerRemainingSeconds > 0);
  const timerRemainingLabel = `${Math.floor(timerRemainingSeconds / 60)}:${String(
    timerRemainingSeconds % 60
  ).padStart(2, "0")}`;
  const startDisabled = !canStart || loading;

  useEffect(() => {
    if (!live?.timer_ends_at) return;
    const interval = setInterval(() => {
      setLive((prev) => (prev ? { ...prev } : prev));
    }, 800);
    return () => clearInterval(interval);
  }, [live?.timer_ends_at, live?.id]);

  useEffect(() => {
    if (!live?.id) {
      setLeaderboard([]);
      setParticipants([]);
      return;
    }
    const loadLiveStats = async () => {
      try {
        const [lbRes, partRes] = await Promise.all([
          getLiveLeaderboard(live.id),
          getLiveParticipants(live.id),
        ]);
        const lbData = toData<any>(lbRes);
        const partData = toData<any>(partRes);
        setLeaderboard(lbData?.leaderboard ?? []);
        setParticipants(partData?.participants ?? []);
      } catch (e) {
        console.error(e);
      }
    };
    loadLiveStats();
    const interval = setInterval(loadLiveStats, 3000);
    return () => clearInterval(interval);
  }, [live?.id]);

  const handleStart = async () => {
    if (!lessonId) {
      setError("Сабақты таңдаңыз.");
      return;
    }
    if (!canStart) {
      setError("Таңдалған live көзіне міндетті өрістерді толтырыңыз.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("lesson_id", String(lessonId));
      form.append("source_type", sourceType);
      if (sourceType === "canva") form.append("canva_embed_url", canvaUrl.trim());
      if (sourceType === "url") form.append("external_view_url", externalUrl.trim());
      if (sourceType === "pptx" && pptxFile) form.append("pptx_file", pptxFile);

      const created = toData<LiveSessionDto>(await startLive(form));
      setLive(created);
      setSlideIndex(created.current_slide_index ?? 0);
      setCopied(false);
    } catch (e: any) {
      console.error(e);
      setError(
        e?.response?.data?.detail ||
          e?.response?.data?.pptx_file?.[0] ||
          e?.response?.data?.canva_embed_url?.[0] ||
          e?.response?.data?.external_view_url?.[0] ||
          "Тірі сабақты бастау кезінде қате болды."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!live) return;
    setLoading(true);
    setError(null);
    try {
      await endLive(live.id);
      setLive(null);
      setSlideIndex(0);
      setCopied(false);
    } catch (e) {
      console.error(e);
      setError("Тірі сабақты аяқтау кезінде қате болды.");
    } finally {
      setLoading(false);
    }
  };

  const updateSlide = async (nextIndex: number) => {
    if (!live) return;
    try {
      const updated = toData<LiveSessionDto>(await setSlide(live.id, nextIndex));
      setLive(updated);
      setSlideIndex(updated.current_slide_index ?? nextIndex);
    } catch (e) {
      console.error(e);
      setError("Слайд индексін жаңарту мүмкін болмады.");
    }
  };

  const handlePrevSlide = () => {
    const next = Math.max(0, slideIndex - 1);
    setSlideIndex(next);
    updateSlide(next);
  };

  const handleNextSlide = () => {
    const next = slideIndex + 1;
    setSlideIndex(next);
    updateSlide(next);
  };

  const handleCopyLink = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setError("Сілтемені көшіру мүмкін болмады.");
    }
  };

  const handleStartTimer = async (durationSeconds: number) => {
    if (!live) return;
    setTimerLoading(true);
    setError(null);
    try {
      const updated = toData<LiveSessionDto>(await startLiveTimer(live.id, durationSeconds));
      setLive(updated);
    } catch (e) {
      console.error(e);
      setError("Таймерді іске қосу мүмкін болмады.");
    } finally {
      setTimerLoading(false);
    }
  };

  const handleStopTimer = async () => {
    if (!live) return;
    setTimerLoading(true);
    setError(null);
    try {
      const updated = toData<LiveSessionDto>(await stopLiveTimer(live.id));
      setLive(updated);
    } catch (e) {
      console.error(e);
      setError("Таймерді тоқтату мүмкін болмады.");
    } finally {
      setTimerLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="hub-hero kz-ornament-card">
        <div className="hub-hero__wrap">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">TEACHER LIVE</div>
            <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
              🎥 Тірі сабақ (PPTX + Embed)
            </h1>
            <p className="mt-2 text-sm md:text-base text-slate-600 max-w-2xl">
              Мұғалім live сессияны бастайды: editor slide, Canva, сыртқы URL немесе PPTX файл.
              Оқушы телефоннан `live code` арқылы қосылады.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="/teacher/lessons"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold border border-slate-900"
              >
                Сабақтар хабы
              </a>
              <a
                href="/analytics"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl border-2 border-slate-300 bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50"
              >
                Аналитика
              </a>
            </div>
          </div>

          <div className="hub-hero__stats sm:grid sm:grid-cols-2 lg:grid-cols-1">
            <div className="hub-stat">
              <div className="hub-stat__num">{live ? "ON" : "OFF"}</div>
              <div className="hub-stat__label">Live статусы</div>
            </div>
            <div className="hub-stat">
              <div className="hub-stat__num">{slideIndex + 1}</div>
              <div className="hub-stat__label">Ағымдағы слайд</div>
            </div>
            <div className="hub-stat">
              <div className="hub-stat__num">{live?.participants_online ?? 0}</div>
              <div className="hub-stat__label">Қатысушылар online</div>
            </div>
            <div className="hub-stat">
              <div className="hub-stat__num">{timerRemainingLabel}</div>
              <div className="hub-stat__label">Таймер</div>
            </div>
          </div>
        </div>
      </section>

      <div className="hub-grid">
        <div className="hub-side space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500">Lesson</label>
            <select
              className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm"
              value={lessonId ?? ""}
              onChange={(e) => setLessonId(Number(e.target.value))}
              disabled={Boolean(live)}
            >
              <option value="" disabled>
                Сабақ таңдаңыз
              </option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Live контент көзі</label>
            <select
              className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as LiveSourceType)}
              disabled={Boolean(live)}
            >
              {SOURCE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {sourceType === "canva" && (
            <div>
              <label className="text-xs font-medium text-slate-500">Canva embed link</label>
              <input
                value={canvaUrl}
                onChange={(e) => setCanvaUrl(e.target.value)}
                className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs"
                disabled={Boolean(live)}
                placeholder="https://www.canva.com/design/.../view?embed"
              />
            </div>
          )}

          {sourceType === "url" && (
            <div>
              <label className="text-xs font-medium text-slate-500">External presentation URL</label>
              <input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs"
                disabled={Boolean(live)}
                placeholder="https://..."
              />
            </div>
          )}

          {sourceType === "pptx" && (
            <div>
              <label className="text-xs font-medium text-slate-500">PPTX файл</label>
              <input
                type="file"
                accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={(e) => setPptxFile(e.target.files?.[0] || null)}
                className="mt-1 w-full text-xs"
                disabled={Boolean(live)}
              />
              {pptxFile && <div className="mt-1 text-[11px] text-slate-500">Таңдалды: {pptxFile.name}</div>}
            </div>
          )}

          {live?.live_code && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="text-xs text-slate-700">
                Тірі код: <span className="font-mono font-semibold text-slate-900">{live.live_code}</span>
              </div>
              <div className="text-xs text-slate-500">
                Қосылған: <span className="font-semibold">{live.participants_online ?? 0}</span>
              </div>
              {qrUrl && (
                <img
                  src={qrUrl}
                  alt="Live join QR"
                  className="h-28 w-28 rounded-lg border border-slate-200 bg-white object-contain"
                />
              )}
            </div>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-600">Таймер</div>
              <div className="text-lg font-semibold text-slate-900">{timerRemainingLabel}</div>
            </div>
            <div className="flex gap-2">
              {[30, 60, 90].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  disabled={!live || timerLoading}
                  onClick={() => {
                    setTimerPreset(sec);
                    void handleStartTimer(sec);
                  }}
                  className={[
                    "px-2.5 py-1.5 rounded-lg border text-xs",
                    timerPreset === sec ? "bg-slate-900 text-white border-slate-900" : "bg-white",
                    !live ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50",
                  ].join(" ")}
                >
                  {sec}s
                </button>
              ))}
              <button
                type="button"
                disabled={!live || timerLoading || !timerRunning}
                onClick={() => void handleStopTimer()}
                className={[
                  "px-2.5 py-1.5 rounded-lg border text-xs",
                  !live || !timerRunning ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" : "bg-white hover:bg-slate-50",
                ].join(" ")}
              >
                Stop
              </button>
            </div>
            <div className="text-[11px] text-slate-500">
              {timerRunning ? "Таймер жүріп тұр (speed score қосулы)." : "Таймер тоқтаулы."}
            </div>
          </div>

          {!live ? (
            <button
              onClick={handleStart}
              disabled={startDisabled}
              className={[
                "w-full h-10 rounded-full text-sm font-semibold border transition",
                startDisabled
                  ? "bg-slate-200 text-slate-700 border-slate-300 cursor-not-allowed"
                  : "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700",
              ].join(" ")}
            >
              {loading ? "Жүктелуде..." : "▶ Тірі сабақты бастау"}
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              className={[
                "w-full h-10 rounded-full text-sm font-semibold border transition",
                loading
                  ? "bg-red-200 text-red-800 border-red-300 cursor-not-allowed"
                  : "bg-red-600 text-white border-red-700 hover:bg-red-700",
              ].join(" ")}
            >
              {loading ? "Жүктелуде..." : "⏹ Тірі сабақты аяқтау"}
            </button>
          )}

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">{error}</div>
          )}
        </div>

        <div className="hub-section flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Тірі презентация</span>
            <span>Slide: {slideIndex + 1}</span>
          </div>

          {live?.live_code && (
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 space-y-2">
              <div className="text-xs text-slate-700">
                Оқушыға кіру: код <span className="font-mono font-semibold">{live.live_code}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-3 py-1.5 rounded border border-sky-200 bg-white hover:bg-sky-100"
                >
                  Оқушы сілтемесін ашу
                </a>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="text-xs px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50"
                >
                  {copied ? "Көшірілді" : "Сілтемені көшіру"}
                </button>
              </div>
            </div>
          )}

          <div className="min-h-[380px] rounded-xl overflow-hidden border bg-slate-50">
            {!live ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">Тірі сабақ басталмаған</div>
            ) : live.source_type === "slides" ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500 px-6 text-center">
                Editor slide режимі: оқушылар Student Live бетінде мұғалім қойған слайд индексін көреді.
              </div>
            ) : live.source_type === "pptx" ? (
              <div className="h-full p-4 flex flex-col gap-3">
                <div className="text-sm text-slate-700">PPTX жүктелді.</div>
                {pptxPreviewUrl ? (
                  <iframe src={pptxPreviewUrl} className="w-full h-[360px] rounded border bg-white" title="PPTX preview PDF" />
                ) : (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    Алдын ала көрініс әлі дайын емес. Файлды ашу/жүктеу арқылы көруге болады.
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {pptxFileUrl && (
                    <a
                      href={pptxFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-3 py-2 rounded border border-slate-200 bg-white hover:bg-slate-100"
                    >
                      PPTX ашу/жүктеу
                    </a>
                  )}
                </div>
                {pptxPreviewUrl ? (
                  <div className="text-[11px] text-slate-500">PDF preview ашылды. Оқушы телефонда да осы preview-ді көреді.</div>
                ) : (
                  <div className="text-[11px] text-slate-500">
                    Ескерту: кей браузер PPTX-ты inline көрсетпейді, бірақ файлды телефонындағы офис-қосымшада ашады.
                  </div>
                )}
              </div>
            ) : (
              <iframe src={contentUrl} className="w-full h-[420px]" title="Live presentation" />
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={handlePrevSlide}
              disabled={!live}
              className={[
                "px-3 py-1 rounded border text-xs font-semibold",
                live ? "bg-white text-slate-900 hover:bg-slate-50" : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed",
              ].join(" ")}
            >
              ◀
            </button>
            <button
              onClick={handleNextSlide}
              disabled={!live}
              className={[
                "px-3 py-1 rounded text-xs font-semibold border",
                live ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800" : "bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed",
              ].join(" ")}
            >
              ▶
            </button>

            {(contentUrl || pptxFileUrl) && (
              <a
                href={contentUrl || pptxFileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-3 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50"
              >
                Жаңа терезеде ашу
              </a>
            )}
          </div>

          {live && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold text-slate-700 mb-2">🏁 Leaderboard</div>
                {leaderboard.length === 0 ? (
                  <div className="text-xs text-slate-500">Әзірше ұпай жоқ.</div>
                ) : (
                  <div className="space-y-1.5">
                    {leaderboard.slice(0, 8).map((p, idx) => (
                      <div key={p.id} className="flex items-center justify-between text-xs rounded border border-slate-100 px-2 py-1">
                        <span className="truncate">
                          {idx + 1}. {p.name || p.username}
                        </span>
                        <span className="font-semibold">{p.points} pt</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold text-slate-700 mb-2">👥 Қатысушылар</div>
                {participants.length === 0 ? (
                  <div className="text-xs text-slate-500">Қосылған оқушы жоқ.</div>
                ) : (
                  <div className="space-y-1.5">
                    {participants.slice(0, 8).map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-xs rounded border border-slate-100 px-2 py-1">
                        <span className="truncate">
                          <span className={p.is_online ? "text-emerald-600" : "text-slate-400"}>●</span>{" "}
                          {p.name || p.username}
                        </span>
                        <span className="text-slate-500">streak {p.streak}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="text-[11px] text-slate-500">
            Телефоннан көру үшін бір Wi-Fi желіде ашып, оқушыға `live code` немесе сілтеме жіберіңіз.
          </div>
        </div>
      </div>
    </div>
  );
}
