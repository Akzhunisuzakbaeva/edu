import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getSlides, getSlideObjects } from "../../api/slide";
import {
  getActiveLives,
  getLiveByCode,
  getLiveLeaderboard,
  joinLive,
  liveHeartbeat,
  LiveParticipantDto,
  LiveSessionDto,
  submitLiveCheckin,
} from "../../services/live";

type Slide = { id: number; title?: string };
type SlideObject = {
  id: number;
  object_type: string;
  data: any;
  position: { x?: number; y?: number; width?: number; height?: number };
  z_index?: number;
};

function toData<T>(value: T | { data: T }): T {
  return (value as { data?: T })?.data ?? (value as T);
}

function sourceLabel(sourceType?: string) {
  if (sourceType === "pptx") return "PPTX";
  if (sourceType === "canva") return "Canva";
  if (sourceType === "url") return "Web";
  return "Slides";
}

function withPdfViewerOptions(url: string) {
  if (!url) return "";
  if (url.includes("#")) return url;
  return `${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
}

function getTimerRemainingSeconds(live?: LiveSessionDto | null) {
  if (!live?.timer_ends_at) return 0;
  const endAt = new Date(live.timer_ends_at).getTime();
  return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
}

export default function StudentLivePage() {
  const [searchParams] = useSearchParams();
  const initialCode = (searchParams.get("code") || "").toUpperCase();

  const [sessions, setSessions] = useState<LiveSessionDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [liveCode, setLiveCode] = useState(initialCode);
  const [connected, setConnected] = useState(false);
  const [current, setCurrent] = useState<LiveSessionDto | null>(null);
  const [participant, setParticipant] = useState<LiveParticipantDto | null>(null);
  const [leaderboard, setLeaderboard] = useState<LiveParticipantDto[]>([]);
  const [slideSeenAt, setSlideSeenAt] = useState<number>(Date.now());
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState<string>("");

  const [slides, setSlides] = useState<Slide[]>([]);
  const [objects, setObjects] = useState<SlideObject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadActiveSessions = async () => {
    try {
      const res = await getActiveLives();
      const list = toData<LiveSessionDto[]>(res) || [];
      setSessions(list);
      if (!selectedId && list.length) setSelectedId(list[0].id);

      if (connected && current?.id) {
        const updated = list.find((s) => s.id === current.id) || null;
        if (updated) {
          setCurrent(updated);
        } else {
          setConnected(false);
          setCurrent(null);
          setError("Тірі сабақ аяқталды.");
        }
      }
    } catch (e) {
      console.error(e);
      setError("Live тізімін жүктеу кезінде қате.");
    }
  };

  useEffect(() => {
    loadActiveSessions();
    const timer = setInterval(loadActiveSessions, 2500);
    return () => clearInterval(timer);
  }, [connected, current?.id, selectedId]);

  useEffect(() => {
    if (!initialCode || connected) return;
    const autoConnect = async () => {
      try {
        const res = await getLiveByCode(initialCode);
        const live = toData<LiveSessionDto>(res);
        setCurrent(live);
        setSelectedId(live.id);
        setConnected(true);
        setError(null);
      } catch {
        setError("Код бойынша тірі сабақ табылмады.");
      }
    };
    autoConnect();
  }, [initialCode, connected]);

  useEffect(() => {
    if (!connected || !current || current.source_type !== "slides") {
      setSlides([]);
      setObjects([]);
      return;
    }

    const loadSlides = async () => {
      try {
        const list = await getSlides({ lesson: current.lesson });
        setSlides(list || []);
      } catch (e) {
        console.error(e);
        setError("Slide тізімін жүктеу кезінде қате.");
      }
    };
    loadSlides();
  }, [connected, current?.id, current?.source_type, current?.lesson]);

  useEffect(() => {
    if (!connected || !current || current.source_type !== "slides") {
      setObjects([]);
      return;
    }
    const slide = slides[current.current_slide_index];
    if (!slide) {
      setObjects([]);
      return;
    }

    const loadObjects = async () => {
      try {
        const list = await getSlideObjects({ slide: slide.id });
        setObjects(list || []);
      } catch (e) {
        console.error(e);
        setError("Слайд объектілерін жүктеу кезінде қате.");
      }
    };
    loadObjects();
  }, [connected, current?.id, current?.source_type, current?.current_slide_index, slides]);

  useEffect(() => {
    if (!connected || !current?.id) {
      setParticipant(null);
      setLeaderboard([]);
      return;
    }
    const doJoin = async () => {
      try {
        const nameHint =
          localStorage.getItem("full_name") ||
          localStorage.getItem("username") ||
          "";
        const res = await joinLive(current.id, nameHint || undefined);
        const data = toData<any>(res);
        setParticipant(data?.participant ?? null);
        setLeaderboard(data?.leaderboard ?? []);
        setCheckinMessage("");
      } catch (e) {
        console.error(e);
      }
    };
    doJoin();
  }, [connected, current?.id]);

  useEffect(() => {
    if (!connected || !current?.id) return;
    const sendHeartbeat = async () => {
      try {
        const res = await liveHeartbeat(current.id, current.current_slide_index);
        const data = toData<any>(res);
        setParticipant((prev) => data?.participant ?? prev);
      } catch (e) {
        console.error(e);
      }
    };
    sendHeartbeat();
    const timer = setInterval(sendHeartbeat, 8000);
    return () => clearInterval(timer);
  }, [connected, current?.id, current?.current_slide_index]);

  useEffect(() => {
    if (!connected || !current?.id) return;
    const loadBoard = async () => {
      try {
        const res = await getLiveLeaderboard(current.id);
        const data = toData<any>(res);
        setLeaderboard(data?.leaderboard ?? []);
      } catch (e) {
        console.error(e);
      }
    };
    loadBoard();
    const timer = setInterval(loadBoard, 5000);
    return () => clearInterval(timer);
  }, [connected, current?.id]);

  useEffect(() => {
    setSlideSeenAt(Date.now());
    setCheckinMessage("");
  }, [current?.id, current?.current_slide_index]);

  const handleConnectByCode = async () => {
    const normalized = liveCode.trim().toUpperCase();
    if (!normalized) {
      setError("Live код енгізіңіз.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getLiveByCode(normalized);
      const live = toData<LiveSessionDto>(res);
      setCurrent(live);
      setSelectedId(live.id);
      setConnected(true);
    } catch {
      setError("Код қате немесе live аяқталған.");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectFromList = () => {
    if (!selectedId) {
      setError("Active live таңдаңыз.");
      return;
    }
    const chosen = sessions.find((s) => s.id === selectedId);
    if (!chosen) {
      setError("Таңдалған live табылмады.");
      return;
    }

    setLoading(true);
    setError(null);
    if (chosen.live_code) {
      getLiveByCode(chosen.live_code)
        .then((res) => {
          const live = toData<LiveSessionDto>(res);
          setCurrent(live);
          setConnected(true);
        })
        .catch(() => {
          setCurrent(chosen);
          setConnected(true);
        })
        .finally(() => setLoading(false));
      return;
    }
    setCurrent(chosen);
    setConnected(true);
    setLoading(false);
  };

  const handleDisconnect = () => {
    setConnected(false);
    setCurrent(null);
    setSlides([]);
    setObjects([]);
    setParticipant(null);
    setLeaderboard([]);
    setCheckinMessage("");
  };

  const handleCheckin = async () => {
    if (!current) return;
    setCheckinBusy(true);
    setError(null);
    try {
      const reactionMs = Math.max(0, Date.now() - slideSeenAt);
      const res = await submitLiveCheckin(current.id, current.current_slide_index, reactionMs);
      const data = toData<any>(res);
      setParticipant(data?.participant ?? null);
      setLeaderboard(data?.leaderboard ?? []);

      if (data?.awarded_points > 0) {
        setCheckinMessage(
          `+${data.awarded_points} ұпай · орын #${data.rank ?? "-"} · streak ${data?.participant?.streak ?? 0}`
        );
      } else {
        setCheckinMessage(data?.detail || "Бұл слайд үшін чек-ин бұрын жіберілген.");
      }
    } catch (e) {
      console.error(e);
      setError("Чек-ин жіберу мүмкін болмады.");
    } finally {
      setCheckinBusy(false);
    }
  };

  const statusBadge = useMemo(() => {
    if (!current) return null;
    return current.is_active ? (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        Live
      </span>
    ) : (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
        Offline
      </span>
    );
  }, [current]);

  const contentUrl = current?.content_url?.trim() || "";
  const pptxFileUrl = current?.pptx_file_url?.trim() || "";
  const pptxPreviewUrl = withPdfViewerOptions(current?.pptx_preview_url?.trim() || "");
  const liveSource = sourceLabel(current?.source_type);
  const timerRemainingSeconds = getTimerRemainingSeconds(current);
  const timerLabel = `${Math.floor(timerRemainingSeconds / 60)}:${String(
    timerRemainingSeconds % 60
  ).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-4 md:p-5">
        <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-sky-200/40 blur-2xl" />
        <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-emerald-200/35 blur-2xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Student Live</div>
            <div className="text-lg md:text-xl font-semibold text-slate-900">Оқушы Live көрінісі</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {statusBadge}
            {connected && current && (
              <>
                <span className="px-2.5 py-1 rounded-full text-[11px] border border-slate-200 bg-white text-slate-700">
                  Код: <span className="font-mono font-semibold">{current.live_code || "-"}</span>
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] border border-slate-200 bg-white text-slate-700">
                  Түрі: <span className="font-semibold">{liveSource}</span>
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] border border-slate-200 bg-white text-slate-700">
                  Slide: <span className="font-semibold">{current.current_slide_index + 1}</span>
                </span>
                {timerRemainingSeconds > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] border border-red-200 bg-red-50 text-red-700">
                    Таймер: <span className="font-semibold">{timerLabel}</span>
                  </span>
                )}
                {participant && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] border border-amber-200 bg-amber-50 text-amber-800">
                    Ұпай: <span className="font-semibold">{participant.points}</span>
                  </span>
                )}
                {participant && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] border border-violet-200 bg-violet-50 text-violet-800">
                    Streak: <span className="font-semibold">{participant.streak}</span>
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {!connected && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900 mb-3">Код арқылы жылдам қосылу</div>
            <div className="flex gap-2">
              <input
                value={liveCode}
                onChange={(e) => setLiveCode(e.target.value.toUpperCase())}
                className="flex-1 border rounded-xl px-3 py-2.5 text-sm bg-slate-50 uppercase outline-none focus:ring-2 focus:ring-sky-200"
                placeholder="Мысалы: TYJMD8"
              />
              <button
                onClick={handleConnectByCode}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-black text-white text-sm disabled:opacity-60"
              >
                {loading ? "..." : "Қосылу"}
              </button>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">Мұғалім берген кодты енгізіңіз.</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900 mb-3">Немесе тізімнен таңдаңыз</div>
            <div className="flex gap-2">
              <select
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                className="flex-1 border rounded-xl px-3 py-2.5 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-sky-200"
              >
                <option value="" disabled>
                  Active live таңдаңыз
                </option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.id} · {s.lesson_title ?? `Lesson ${s.lesson}`} · код {s.live_code || "-"}
                  </option>
                ))}
              </select>
              <button
                onClick={handleConnectFromList}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-sky-600 text-white text-sm hover:bg-sky-700 disabled:opacity-60"
              >
                Кіру
              </button>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">Қай сабақ live екенін осы жерден көресіз.</div>
          </div>
        </div>
      )}

      {connected && current && (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 md:px-5 py-3 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-slate-700">
              Lesson: <span className="font-semibold text-slate-900">{current.lesson_title ?? `Lesson ${current.lesson}`}</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
            >
              Шығу
            </button>
          </div>

          <div className="px-4 md:px-5 py-3 border-b border-slate-100 bg-white grid gap-3 lg:grid-cols-[1fr_280px]">
            <div className="space-y-2">
              <div className="text-xs text-slate-600">
                Слайдты көрген соң жауап бергенде <b>Жауап жіберу</b> батырмасын басыңыз. Жылдам жіберсеңіз ұпай жоғары.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void handleCheckin()}
                  disabled={checkinBusy}
                  className={[
                    "px-3 py-1.5 rounded-lg text-xs font-semibold border",
                    checkinBusy ? "bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed" : "bg-black text-white border-black hover:bg-slate-800",
                  ].join(" ")}
                >
                  {checkinBusy ? "..." : "Жауап жіберу"}
                </button>
                {checkinMessage && (
                  <span className="text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                    {checkinMessage}
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500 mb-2">Top нәтиже</div>
              {leaderboard.length === 0 ? (
                <div className="text-xs text-slate-500">Әзірше бос.</div>
              ) : (
                <div className="space-y-1">
                  {leaderboard.slice(0, 5).map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="truncate">
                        {idx + 1}. {p.name || p.username}
                      </span>
                      <span className="font-semibold">{p.points}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {current.source_type === "slides" && (
            <div className="p-4 md:p-5">
              <div className="min-h-[460px] rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 relative">
                <div className="absolute inset-4 rounded-2xl bg-white border border-black/5 shadow-sm" />
                {objects
                  .sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0))
                  .map((o) => {
                    const pos = o.position || {};
                    const style = {
                      position: "absolute" as const,
                      left: pos.x ?? 80,
                      top: pos.y ?? 120,
                      width: pos.width ?? 300,
                      height: pos.height ?? 120,
                    };
                    if (o.object_type === "image" && o.data?.url) {
                      return (
                        <img
                          key={o.id}
                          src={o.data.url}
                          alt=""
                          style={style}
                          className="object-cover rounded-lg"
                        />
                      );
                    }
                    const text = o.object_type === "checkbox" ? `☐ ${o.data?.label ?? ""}` : o.data?.text ?? "";
                    return (
                      <div key={o.id} style={style} className="text-sm text-slate-700">
                        {text}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {(current.source_type === "canva" || current.source_type === "url") && (
            <div className="p-4 md:p-5">
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                <iframe src={contentUrl} className="w-full h-[560px]" title="Live presentation" />
              </div>
            </div>
          )}

          {current.source_type === "pptx" && (
            <div className="p-4 md:p-5 grid gap-4 xl:grid-cols-[1fr_280px]">
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                {pptxPreviewUrl ? (
                  <iframe
                    src={pptxPreviewUrl}
                    className="w-full h-[560px]"
                    title="PPTX preview PDF"
                  />
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-sm text-slate-500 bg-slate-50">
                    PDF preview дайын емес
                  </div>
                )}
              </div>

              <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="text-sm font-semibold text-slate-900">PPTX режимі</div>
                <div className="text-xs text-slate-600 leading-5">
                  Preview көрсетіліп тұр. Қажет болса түпнұсқа файлды жүктеп, телефондағы қосымшада да аша аласыз.
                </div>

                {pptxPreviewUrl && (
                  <a
                    href={pptxPreviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-center text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100"
                  >
                    PDF-ті жаңа бетте ашу
                  </a>
                )}

                {pptxFileUrl && (
                  <a
                    href={pptxFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-center text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100"
                  >
                    PPTX ашу/жүктеу
                  </a>
                )}
              </aside>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
          {error}
        </div>
      )}
    </div>
  );
}
