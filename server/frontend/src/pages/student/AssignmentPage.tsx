import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/axios";

type Assignment = {
  id: number;
  title: string;
  description?: string;
  assignment_type?: string;
  effective_assignment_type?: string;
  content_id?: number | null;
  lesson_title?: string;
  due_at?: string | null;
};

export default function AssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<Assignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [resolvedType, setResolvedType] = useState<string | null>(null);
  const startedAtRef = useRef(Date.now());
  const gameTypes = new Set([
    "quiz",
    "poll",
    "matching",
    "sorting",
    "grouping",
    "flashcards",
    "crossword",
  ]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const res = await api.get(`/lessons/assignments/mine/?include_locked=1`);
        const list: Assignment[] = res.data ?? [];
        const found = list.find((a) => String(a.id) === String(id));
        if (!found) {
          setError("Тапсырма сізге тағайындалмаған немесе табылмады.");
          return;
        }
        setItem(found);
        startedAtRef.current = Date.now();
        if (found.assignment_type === "other" && found.content_id) {
          try {
            const tpl = await api.get(`/slide/templates/${found.content_id}/`);
            setResolvedType(tpl.data?.template_type || null);
          } catch (e) {
            setResolvedType(null);
          }
        } else {
          setResolvedType(null);
        }
      } catch (e) {
        console.error(e);
        setError("Тапсырма жүктелмеді.");
      }
    };
    load();
  }, [id]);

  if (error) return <div className="text-red-600">{error}</div>;
  if (!item) return <div>Жүктелуде...</div>;
  const currentType = item.effective_assignment_type || resolvedType || item.assignment_type || "other";

  const due = item.due_at ? new Date(item.due_at).getTime() : null;
  const now = Date.now();
  const remainingMs = due ? Math.max(0, due - now) : null;
  const overdue = due ? now > due : false;
  const fmtRemaining = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${d}d ${h}h ${m}m ${s}s`;
  };
  const go = () => {
    if (!currentType || !item.content_id) {
      alert("Контент байланбаған.");
      return;
    }
    const type = currentType;
    if (type === "quiz") {
      window.location.href = `/game/quiz/${item.content_id}?template=${item.content_id}&assignment=${item.id}`;
    } else if (type === "poll") {
      window.location.href = `/game/poll/${item.content_id}?assignment=${item.id}`;
    } else if (type === "matching") {
      window.location.href = `/game/matching/${item.content_id}?assignment=${item.id}`;
    } else if (type === "sorting") {
      window.location.href = `/game/sorting/${item.content_id}?assignment=${item.id}`;
    } else if (type === "grouping") {
      window.location.href = `/game/grouping?template=${item.content_id}&assignment=${item.id}`;
    } else if (type === "flashcards") {
      window.location.href = `/game/flashcards/${item.content_id}?assignment=${item.id}`;
    } else if (type === "crossword") {
      window.location.href = `/game/crossword/${item.content_id}?assignment=${item.id}`;
    } else {
      alert("Бұл типке маршрут жоқ.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-1">
          ТАПСЫРМА
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {item.title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Сабақ: {item.lesson_title ?? "-"} · Тип: {currentType}
        </p>
        {item.due_at && (
          <div className="mt-2 text-xs">
            {overdue ? (
              <span className="px-2 py-1 rounded-full border border-red-200 bg-red-50 text-red-700">
                Кешіктірілді · {new Date(item.due_at).toLocaleString()}
              </span>
            ) : (
              <span className="px-2 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                Қалған уақыт: {remainingMs ? fmtRemaining(remainingMs) : "-"}
              </span>
            )}
          </div>
        )}
      </div>

      {item.description && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          {item.description}
        </div>
      )}

      {!gameTypes.has(currentType) && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="text-sm font-medium text-slate-700">Жауап жіберу</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Жауап мәтіні (optional)"
            className="w-full border rounded-lg px-3 py-2 text-sm min-h-[100px]"
          />
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
          <button
            onClick={async () => {
              if (!item) return;
              try {
                const form = new FormData();
                form.append("assignment", String(item.id));
                if (text.trim()) form.append("text", text.trim());
                if (file) form.append("file", file);
                const durationSeconds = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
                form.append("duration_seconds", String(durationSeconds));
                const res = await api.post("/lessons/submissions/", form, {
                  headers: { "Content-Type": "multipart/form-data" },
                });
                const recommendation = res?.data?.adaptive_feedback?.recommendation;
                setMsg(
                  recommendation
                    ? `Жауап жіберілді ✅ ${recommendation}`
                    : "Жауап жіберілді ✅"
                );
                setText("");
                setFile(null);
              } catch (e) {
                console.error(e);
                setMsg("Жіберу кезінде қате болды.");
              }
            }}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm"
          >
            Жіберу
          </button>
          {msg && <div className="text-xs text-slate-600">{msg}</div>}
        </div>
      )}

      {gameTypes.has(currentType) && (
        <button
          onClick={go}
          className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm"
        >
          Тапсырманы орындау →
        </button>
      )}
    </div>
  );
}
