import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";

type Enrollment = {
  id: number;
  lesson: number;
  lesson_title?: string;
  joined_at?: string;
};
type Assignment = {
  id: number;
  lesson: number;
  lesson_title?: string;
  title: string;
  description?: string;
  assignment_type?: string;
  content_id?: number | null;
  due_at?: string | null;
  created_at?: string;
};
type Reward = {
  id: number;
  title: string;
  description?: string;
  level?: string;
  icon?: string;
  created_at?: string;
};
type TopicMetric = {
  topic: string;
  avg_score: number;
  attempts: number;
};
type TrajectoryNode = {
  lesson: number;
  lesson_title?: string;
  topic: string;
  status: "locked" | "unlocked" | "in_progress" | "review" | "completed" | string;
  recommendation?: string;
};
type StudentInsight = {
  learning_level?: string;
  average_score?: number;
  completion_rate?: number;
  recommendation?: string;
  weak_topics?: TopicMetric[];
  strong_topics?: TopicMetric[];
  trajectory?: TrajectoryNode[];
};

function fmtDate(s?: string | null) {
  if (!s) return "Дедлайн жоқ";
  const d = new Date(s);
  return d.toLocaleString();
}

export default function StudentDashboardPage() {
  const [items, setItems] = useState<Enrollment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [insight, setInsight] = useState<StudentInsight | null>(null);

  const load = async () => {
    try {
      setError(null);
      setLoading(true);

      const res = await api.get("/lessons/enrollments/");
      setItems(res.data ?? []);
      const asg = await api.get("/lessons/assignments/mine/");
      setAssignments(asg.data ?? []);
      const r = await api.get("/lessons/rewards/");
      setRewards(r.data ?? []);
      const insightRes = await api.get("/lessons/insights/student/");
      setInsight(insightRes.data ?? null);
    } catch (e: any) {
      console.error("TASKS LOAD ERROR", e);
      setError(
        "Сабақтар жүктелмеді. Console → Network қара."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = a.joined_at ? new Date(a.joined_at).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.joined_at ? new Date(b.joined_at).getTime() : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
  }, [items]);

  const filteredAssignments = useMemo(() => assignments, [assignments]);

  const joinLesson = async () => {
    if (!joinCode.trim()) return;
    try {
      await api.post("/lessons/lessons/join/", { code: joinCode.trim() });
      setJoinCode("");
      await load();
    } catch (e) {
      console.error(e);
      setError("Қосылу кезінде қате болды. Кодты тексеріңіз.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-1">
            STUDENT PANEL
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">📚 Менің сабақтарым</h1>
          <p className="mt-2 text-sm text-slate-500">
            Мұғалім берген код арқылы сабаққа қосылыңыз.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Қосу коды"
            className="h-10 px-3 rounded-full border bg-white text-sm"
          />
          <button
            onClick={joinLesson}
            className="h-10 px-4 rounded-full bg-slate-900 text-white text-sm"
          >
            ➕ Қосу
          </button>
          <button
            onClick={() => void load()}
            className="h-10 px-4 rounded-full border bg-white hover:bg-slate-50 text-sm"
          >
            🔄 Жаңарту
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {rewards.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="text-sm font-medium text-slate-700 mb-3">Марапаттар</div>
          <div className="grid gap-3 md:grid-cols-3">
            {rewards.slice(0, 3).map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-slate-100 bg-slate-50/40 p-3"
              >
                <div className="text-2xl">{r.icon ?? "🏆"}</div>
                <div className="text-sm font-semibold">{r.title}</div>
                {r.description && (
                  <div className="text-xs text-slate-500">{r.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {insight && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">Жеке оқу трегі</div>
            <div className="text-[11px] px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
              Деңгей: {insight.learning_level ?? "-"}
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50/40 p-3">
              <div className="text-[11px] text-slate-500">Орташа нәтиже</div>
              <div className="text-lg font-semibold">{Math.round(insight.average_score ?? 0)}%</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/40 p-3">
              <div className="text-[11px] text-slate-500">Траектория орындалуы</div>
              <div className="text-lg font-semibold">{Math.round(insight.completion_rate ?? 0)}%</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/40 p-3">
              <div className="text-[11px] text-slate-500">Ұсыныс</div>
              <div className="text-sm font-medium">{insight.recommendation || "Жалғастырыңыз"}</div>
            </div>
          </div>

          {(insight.weak_topics?.length || insight.strong_topics?.length) && (
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-rose-100 bg-rose-50/40 p-3">
                <div className="text-xs font-semibold text-rose-700 mb-1">Қиын тақырыптар</div>
                {insight.weak_topics?.length ? (
                  <div className="space-y-1">
                    {insight.weak_topics.slice(0, 3).map((w) => (
                      <div key={w.topic} className="text-xs text-rose-700">
                        {w.topic} · {Math.round((w.avg_score || 0) * 100)}%
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Әзірге анықталған жоқ.</div>
                )}
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                <div className="text-xs font-semibold text-emerald-700 mb-1">Күшті тақырыптар</div>
                {insight.strong_topics?.length ? (
                  <div className="space-y-1">
                    {insight.strong_topics.slice(0, 3).map((s) => (
                      <div key={s.topic} className="text-xs text-emerald-700">
                        {s.topic} · {Math.round((s.avg_score || 0) * 100)}%
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Әзірге анықталған жоқ.</div>
                )}
              </div>
            </div>
          )}

          {insight.trajectory?.length ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700">Келесі модульдер</div>
              {insight.trajectory.slice(0, 4).map((node) => (
                <div key={`${node.lesson}-${node.topic}`} className="flex items-center justify-between text-xs border border-slate-100 rounded-lg px-3 py-2">
                  <div>{node.lesson_title || node.topic}</div>
                  <div className="uppercase tracking-wide text-slate-500">{node.status}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="text-sm font-medium text-slate-700 mb-3">Сабақтар тізімі</div>

        {loading ? (
          <div className="text-sm text-slate-500">Жүктелуде...</div>
        ) : sorted.length === 0 ? (
          <div className="text-sm text-slate-500">
            Әзірше сабақ жоқ. Мұғалім берген кодпен қосылыңыз.
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((t) => {
              return (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-slate-800">
                        {t.lesson_title ?? `Lesson #${t.lesson}`}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Қосылған уақыт: <span className="font-mono">{fmtDate(t.joined_at)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="h-9 px-3 rounded-full border bg-white hover:bg-slate-50 text-xs"
                      onClick={() => {
                        window.location.href = `/student/lessons/${t.lesson}`;
                      }}
                    >
                      📝 Ашып көру
                    </button>
                    <button
                      className="h-9 px-3 rounded-full bg-slate-900 text-white hover:bg-slate-800 text-xs"
                      onClick={() => {
                        window.location.href = `/student/lessons/${t.lesson}`;
                      }}
                    >
                      👁 Тапсырмалар
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="text-sm font-medium text-slate-700 mb-3">
          Менің тапсырмаларым
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Жүктелуде...</div>
        ) : filteredAssignments.length === 0 ? (
          <div className="text-sm text-slate-500">Әзірше тапсырма жоқ.</div>
        ) : (
          <div className="space-y-3">
            {filteredAssignments.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-800">
                    {a.title}
                  </div>
                  <div className="text-xs text-slate-500">{a.description}</div>
                  <div className="text-[11px] text-slate-400">
                    Сабақ: {a.lesson_title ?? a.lesson} · Тип: {a.assignment_type ?? "other"} · Due:{" "}
                    {a.due_at ? fmtDate(a.due_at) : "-"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="h-9 px-3 rounded-full border bg-white hover:bg-slate-50 text-xs"
                    onClick={() => {
                      window.location.href = `/student/assignments/${a.id}`;
                    }}
                  >
                    👁 Ашып көру
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
