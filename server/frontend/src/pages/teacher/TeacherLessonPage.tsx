import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/axios";
import { applyTemplate } from "../../api/templates";

type Lesson = {
  id: number;
  title: string;
  description?: string;
  subject?: string;
  grade?: string;
  topic?: string;
  objectives?: string;
  materials?: string;
  homework?: string;
  assessment?: string;
  resources?: string;
  duration_minutes?: number | null;
  share_code?: string | null;
  is_shared?: boolean;
  created_at?: string;
};

type Assignment = {
  id: number;
  lesson: number;
  title: string;
  description?: string;
  assignment_type?: string;
  content_id?: number | null;
  due_at?: string | null;
  is_published?: boolean;
  created_at?: string;
};

type Slide = {
  id: number;
  title?: string;
  order?: number;
  created_at?: string;
};

type Template = {
  id: number;
  title: string;
  template_type?: string;
};

function fmtDate(s?: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  return d.toLocaleString();
}

export default function TeacherLessonPage() {
  const { id } = useParams();
  const lessonId = Number(id);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplId, setTplId] = useState("");
  const [tplMsg, setTplMsg] = useState<string | null>(null);
  const [asgTitle, setAsgTitle] = useState("");
  const [asgType, setAsgType] = useState("quiz");
  const [asgContentId, setAsgContentId] = useState("");
  const [asgDueDate, setAsgDueDate] = useState("");
  const [asgDueTime, setAsgDueTime] = useState("");
  const [asgPublished, setAsgPublished] = useState(true);
  const [asgMsg, setAsgMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!lessonId) return;
    try {
      setLoading(true);
      const l = await api.get(`/lessons/lessons/${lessonId}/`);
      setLesson(l.data);
      const a = await api.get("/lessons/assignments/");
      setAssignments(a.data ?? []);
      const s = await api.get(`/slide/slides/?lesson=${lessonId}`);
      setSlides(s.data ?? []);
      const t = await api.get("/slide/templates/");
      setTemplates(t.data ?? []);
    } catch (e) {
      console.error(e);
      setTplMsg("Сабақ жүктелмеді.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [lessonId]);

  const lessonAssignments = useMemo(
    () => assignments.filter((a) => a.lesson === lessonId),
    [assignments, lessonId]
  );

  const onApplyTemplate = async () => {
    if (!tplId) {
      setTplMsg("Шаблон таңдаңыз.");
      return;
    }
    try {
      await applyTemplate(Number(tplId), { lesson_id: lessonId });
      setTplMsg("Шаблон сабаққа қосылды ✅");
      await load();
    } catch (e) {
      console.error(e);
      setTplMsg("Шаблонды қосу кезінде қате болды.");
    }
  };

  const onCreateAssignment = async () => {
    setAsgMsg(null);
    if (!asgTitle.trim()) {
      setAsgMsg("Тапсырма атауын жазыңыз.");
      return;
    }
    const dueAt =
      asgDueDate && asgDueTime ? `${asgDueDate}T${asgDueTime}` : null;
    try {
      await api.post("/lessons/assignments/", {
        lesson: lessonId,
        title: asgTitle.trim(),
        description: "",
        assignment_type: asgType,
        content_id: asgContentId ? Number(asgContentId) : null,
        due_at: dueAt,
        is_published: asgPublished,
      });
      setAsgTitle("");
      setAsgContentId("");
      setAsgDueDate("");
      setAsgDueTime("");
      setAsgPublished(true);
      setAsgMsg("Тапсырма құрылды ✅");
      await load();
    } catch (e) {
      console.error(e);
      setAsgMsg("Тапсырма құру кезінде қате.");
    }
  };

  if (!lessonId) return <div>Lesson ID жоқ.</div>;
  if (loading) return <div>Жүктелуде...</div>;

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
          Құрылған: {lesson?.created_at ? fmtDate(lesson.created_at) : "-"} ·
          Код: {lesson?.share_code ?? "-"}
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

      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="text-sm font-medium text-slate-700">Сабаққа шаблон қосу</div>
        <div className="flex gap-2">
          <select
            value={tplId}
            onChange={(e) => setTplId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm flex-1"
          >
            <option value="">Template таңдау</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.id} · {t.title}
              </option>
            ))}
          </select>
          <button
            onClick={onApplyTemplate}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm"
          >
            Қосу
          </button>
        </div>
        {tplMsg && (
          <div className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2">
            {tplMsg}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
        <div className="text-sm font-medium text-slate-700">Тапсырма құру</div>
        <div className="grid gap-2 md:grid-cols-5">
          <input
            value={asgTitle}
            onChange={(e) => setAsgTitle(e.target.value)}
            placeholder="Тапсырма атауы"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={asgType}
            onChange={(e) => setAsgType(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="quiz">Quiz</option>
            <option value="matching">Matching</option>
            <option value="sorting">Sorting</option>
            <option value="poll">Poll</option>
            <option value="grouping">Grouping</option>
            <option value="slides">Слайдтар</option>
          </select>
          <select
            value={asgContentId}
            onChange={(e) => setAsgContentId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Template таңдау (optional)</option>
            {templates
              .filter((t) => !asgType || t.template_type === asgType)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} · {t.title}
                </option>
              ))}
          </select>
          <input
            type="date"
            value={asgDueDate}
            onChange={(e) => setAsgDueDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="time"
            value={asgDueTime}
            onChange={(e) => setAsgDueTime(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={asgPublished}
            onChange={(e) => setAsgPublished(e.target.checked)}
          />
          Publish
        </label>
        <button
          onClick={onCreateAssignment}
          className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm"
        >
          Тапсырма құру
        </button>
        {asgMsg && (
          <div className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2">
            {asgMsg}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-700 mb-3">Тапсырмалар</div>
        {lessonAssignments.length === 0 ? (
          <div className="text-sm text-slate-500">Әзірше тапсырма жоқ.</div>
        ) : (
          <div className="space-y-2">
            {lessonAssignments.map((a) => (
              <div
                key={a.id}
                className="border rounded-lg px-3 py-2 text-xs bg-white"
              >
                <div className="font-semibold text-sm">{a.title}</div>
                <div className="text-slate-500">
                  Тип: {a.assignment_type} · Due:{" "}
                  {a.due_at ? fmtDate(a.due_at) : "-"} ·{" "}
                  {a.is_published ? "Published" : "Draft"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-700 mb-3">Слайдтар</div>
        {slides.length === 0 ? (
          <div className="text-sm text-slate-500">Әзірше слайд жоқ.</div>
        ) : (
          <div className="space-y-2">
            {slides.map((s) => (
              <div key={s.id} className="border rounded-lg px-3 py-2 text-xs">
                #{s.id} · {s.title ?? "Untitled"}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
