import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { createSubmission } from "../../api/slide";
import { resolveNextAssignmentPath } from "../../services/assignmentFlow";

type Cell = { r: number; c: number; letter: string };
type CrosswordTemplate = {
  id: number;
  title: string;
  template_type: "crossword" | string;
  data: { rows?: number; cols?: number; cells?: Cell[]; clues?: { across?: string[]; down?: string[] } };
};

export default function CrosswordGame() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const templateId = Number(id);
  const assignmentId = Number(searchParams.get("assignment")) || null;
  const [tpl, setTpl] = useState<CrosswordTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grid, setGrid] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/slide/templates/${templateId}/`);
        setTpl(res.data);
      } catch (e) {
        console.error(e);
        setError("Crossword шаблонын жүктеу кезінде қате болды.");
      } finally {
        setLoading(false);
      }
    };
    if (templateId) load();
  }, [templateId]);

  const expected = useMemo(() => {
    const map: Record<string, string> = {};
    (tpl?.data?.cells || []).forEach((c) => {
      map[`${c.r},${c.c}`] = String(c.letter || "").toUpperCase();
    });
    return map;
  }, [tpl]);

  if (loading) return <div>Жүктелуде...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!tpl) return <div>Crossword табылмады.</div>;

  const rows = tpl.data?.rows ?? 5;
  const cols = tpl.data?.cols ?? 5;
  const across = tpl.data?.clues?.across || [];
  const down = tpl.data?.clues?.down || [];

  const handleChange = (r: number, c: number, value: string) => {
    const v = value.slice(-1).toUpperCase();
    setGrid((prev) => ({ ...prev, [`${r},${c}`]: v }));
  };

  const submit = async () => {
    const cells = Object.keys(expected).map((key) => {
      const [r, c] = key.split(",").map(Number);
      return { r, c, letter: grid[key] || "" };
    });
    const durationSeconds = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
    try {
      const res = await createSubmission({
        template: tpl.id,
        data: { cells },
        duration_seconds: durationSeconds,
      });
      const path = await resolveNextAssignmentPath(assignmentId);
      setNextPath(path);
      if (typeof res?.correct === "boolean" && !res.correct) {
        setGrid(expected);
        setMsg("Дұрыс жауап торда көрсетілді.");
      } else {
        setMsg("Жауап жіберілді ✅");
      }
    } catch (e) {
      console.error(e);
      setMsg("Жіберу кезінде қате болды.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-4">
      <h1 className="text-2xl font-bold">{tpl.title} 🧩</h1>
      <p className="text-sm text-gray-600">Торды әріптермен толтырыңыз.</p>

      <div className="inline-block bg-white border rounded-lg p-4">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${cols}, 36px)` }}
        >
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((__, c) => {
              const key = `${r},${c}`;
              const active = key in expected;
              if (!active) {
                return <div key={key} className="w-9 h-9" aria-hidden="true" />;
              }
              return (
                <input
                  key={key}
                  value={grid[key] || ""}
                  onChange={(e) => handleChange(r, c, e.target.value)}
                  className="w-9 h-9 text-center border rounded bg-white font-semibold uppercase"
                />
              );
            })
          )}
        </div>
      </div>

      {(across.length > 0 || down.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="bg-white border rounded-lg p-3">
            <div className="text-sm font-semibold mb-2">Көлденең (Across)</div>
            {across.length === 0 ? (
              <div className="text-xs text-slate-500">-</div>
            ) : (
              <ul className="text-xs text-slate-700 space-y-1">
                {across.map((c, idx) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-white border rounded-lg p-3">
            <div className="text-sm font-semibold mb-2">Тігінен (Down)</div>
            {down.length === 0 ? (
              <div className="text-xs text-slate-500">-</div>
            ) : (
              <ul className="text-xs text-slate-700 space-y-1">
                {down.map((c, idx) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm"
      >
        Тексеру
      </button>

      {msg && <div className="text-sm text-slate-600">{msg}</div>}
      {nextPath && (
        <button
          type="button"
          onClick={() => navigate(nextPath)}
          className="px-4 py-2 rounded-md border text-sm"
        >
          Келесі тапсырма
        </button>
      )}
    </div>
  );
}
