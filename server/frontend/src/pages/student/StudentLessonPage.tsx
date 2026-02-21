import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/axios";

type Lesson = {
  id: number;
  title: string;
  description?: string;
  owner_username?: string;
  created_at?: string;
  subject?: string;
  grade?: string;
  topic?: string;
  objectives?: string;
  materials?: string;
  homework?: string;
  assessment?: string;
  resources?: string;
  duration_minutes?: number | null;
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

function fmtDate(s?: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  return d.toLocaleString();
}

export default function StudentLessonPage() {
  const { id } = useParams();
  const lessonId = Number(id);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const l = await api.get(`/lessons/lessons/${lessonId}/`);
        setLesson(l.data);
        const asg = await api.get(`/lessons/assignments/mine/?lesson=${lessonId}&include_locked=1`);
        setAssignments(asg.data ?? []);
      } catch (e) {
        console.error(e);
        setError("Сабақ жүктелмеді.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [lessonId]);

  const filtered = useMemo(
    () => assignments.filter((a) => a.lesson === lessonId),
    [assignments, lessonId]
  );

  if (!lessonId) {
    return <div className="text-sm text-slate-500">Lesson табылмады.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-1">
          LESSON
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {lesson?.title ?? `Сабақ #${lessonId}`}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {lesson?.description || "Сабақ сипаттамасы жоқ."}
        </p>
        <div className="text-[11px] text-slate-400 mt-2">
          Мұғалім: {lesson?.owner_username ?? "-"} · Құрылған:{" "}
          {lesson?.created_at ? fmtDate(lesson.created_at) : "-"}
        </div>
        <div className="text-xs text-slate-600 mt-2">
          {lesson?.subject ? `Пән: ${lesson.subject}` : "Пән: -"} ·{" "}
          {lesson?.grade ? `Сынып: ${lesson.grade}` : "Сынып: -"} ·{" "}
          {lesson?.topic ? `Тақырып: ${lesson.topic}` : "Тақырып: -"} ·{" "}
          {lesson?.duration_minutes ? `${lesson.duration_minutes} мин` : "Ұзақтығы: -"}
        </div>
        {(lesson?.objectives || lesson?.materials || lesson?.homework || lesson?.assessment || lesson?.resources) && (
          <div className="mt-3 grid gap-2 md:grid-cols-2 text-xs text-slate-700">
            <div className="bg-white border rounded-lg p-2">
              <div className="font-semibold">Мақсаты</div>
              <div>{lesson?.objectives || "-"}</div>
            </div>
            <div className="bg-white border rounded-lg p-2">
              <div className="font-semibold">Қажетті құралдар</div>
              <div>{lesson?.materials || "-"}</div>
            </div>
            <div className="bg-white border rounded-lg p-2">
              <div className="font-semibold">Үй тапсырмасы</div>
              <div>{lesson?.homework || "-"}</div>
            </div>
            <div className="bg-white border rounded-lg p-2">
              <div className="font-semibold">Бағалау критерийі</div>
              <div>{lesson?.assessment || "-"}</div>
            </div>
            <div className="bg-white border rounded-lg p-2 md:col-span-2">
              <div className="font-semibold">Қосымша ресурстар</div>
              <div>{lesson?.resources || "-"}</div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="text-sm font-medium text-slate-700 mb-3">
          Тапсырмалар
        </div>
        {loading ? (
          <div className="text-sm text-slate-500">Жүктелуде...</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-slate-500">
            Әзірше тапсырма жоқ.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => (
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
                    Тип: {a.assignment_type ?? "other"} · Due:{" "}
                    {a.due_at ? fmtDate(a.due_at) : "-"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="h-9 px-3 rounded-full bg-slate-900 text-white hover:bg-slate-800 text-xs"
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
