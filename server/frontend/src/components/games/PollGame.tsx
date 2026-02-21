import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { createSubmission } from "../../api/slide";
import { resolveNextAssignmentPath } from "../../services/assignmentFlow";

type PollTemplate = {
  id: number;
  title: string;
  template_type: "poll" | string;
  data: { question?: string; options?: string[] };
};

export default function PollGame() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const templateId = Number(id || searchParams.get("template")) || null;
  const assignmentId = Number(searchParams.get("assignment")) || null;

  const [tpl, setTpl] = useState<PollTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<any[] | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!templateId) {
      setError("Template ID қажет.");
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const res = await api.get(`/slide/templates/${templateId}/`);
        setTpl(res.data);
      } catch (e) {
        console.error(e);
        setError("Poll шаблонын жүктеу кезінде қате болды.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [templateId]);

  const vote = async () => {
    if (!templateId || !selected) return;
    try {
      const durationSeconds = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
      const res = await createSubmission({
        template: templateId,
        data: { answer: selected },
        duration_seconds: durationSeconds,
      });
      if (Array.isArray(res?.results)) {
        setResults(res.results);
      }
      const path = await resolveNextAssignmentPath(assignmentId);
      setNextPath(path);
    } catch (e) {
      console.error("Poll submit error:", e);
      setError("Дауыс беру кезінде қате болды.");
    }
  };

  if (loading) return <div>Жүктелуде...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!tpl) return <div>Poll табылмады.</div>;

  const question = tpl.data?.question || "Сұрақ";
  const options = tpl.data?.options || [];

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-4">
      <h1 className="text-2xl font-bold">{tpl.title} 📊</h1>
      <div className="text-sm text-gray-600">{question}</div>

      <div className="space-y-2">
        {options.map((opt) => (
          <label
            key={opt}
            className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white/70"
          >
            <input
              type="radio"
              name="poll"
              checked={selected === opt}
              onChange={() => setSelected(opt)}
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={vote}
        disabled={!selected}
        className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50"
      >
        Дауыс беру
      </button>

      {results && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">Нәтижелер</div>
          {results.map((r, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span>{r.option}</span>
              <span className="font-mono">{Math.round(r.percentage)}%</span>
            </div>
          ))}
        </div>
      )}
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
