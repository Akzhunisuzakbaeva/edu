import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { createSubmission } from "../../api/slide";
import { resolveNextAssignmentPath } from "../../services/assignmentFlow";

type MatchingTemplate = {
  id: number;
  title: string;
  template_type: "matching" | string;
  data: { left?: string[]; right?: string[] };
};

type Pair = { left: string; right: string };

export default function MatchingGame() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const templateId = Number(id || searchParams.get("template")) || null;
  const assignmentId = Number(searchParams.get("assignment")) || null;

  const [tpl, setTpl] = useState<MatchingTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
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
        setError("Matching шаблонын жүктеу кезінде қате болды.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [templateId]);

  const left = tpl?.data?.left || [];
  const right = tpl?.data?.right || [];

  const usedRight = useMemo(
    () => new Set(pairs.map((p) => p.right)),
    [pairs]
  );

  const selectLeft = (l: string) => {
    setSelectedLeft(l);
    setResultMsg(null);
  };

  const pickRight = (r: string) => {
    if (!selectedLeft) return;
    if (usedRight.has(r)) return;
    setPairs((prev) => [...prev, { left: selectedLeft, right: r }]);
    setSelectedLeft(null);
  };

  const reset = () => {
    setPairs([]);
    setSelectedLeft(null);
    setResultMsg(null);
  };

  const submit = async () => {
    if (!tpl) return;
    const payload = pairs.reduce<Record<string, string>>((acc, p) => {
      acc[p.left] = p.right;
      return acc;
    }, {});
    const durationSeconds = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));

    try {
      const res = await createSubmission({
        template: tpl.id,
        data: { pairs: payload },
        duration_seconds: durationSeconds,
      });
      const correctPairs = left.map((l, idx) => `${l} -> ${right[idx] ?? "-"}`).join(", ");
      const path = await resolveNextAssignmentPath(assignmentId);
      setNextPath(path);
      if (typeof res?.correct === "boolean") {
        setResultMsg(res.correct ? "Дұрыс! 👏" : `Дұрыс жұптар: ${correctPairs}`);
      } else {
        const correct = left.every((l, idx) => payload[l] === right[idx]);
        setResultMsg(correct ? "Дұрыс! 👏" : `Дұрыс жұптар: ${correctPairs}`);
      }
    } catch (e) {
      console.error("Matching submit error:", e);
      const correctPairs = left.map((l, idx) => `${l} -> ${right[idx] ?? "-"}`).join(", ");
      setResultMsg(`Дұрыс жұптар: ${correctPairs}`);
    }
  };

  if (loading) return <div>Жүктелуде...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!tpl) return <div>Matching табылмады.</div>;

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-4">
      <h1 className="text-2xl font-bold">{tpl.title} 🧩</h1>
      <p className="text-sm text-gray-600">Сол жақтағы ұғымды оң жақтағы сәйкесімен жұптаңыз.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          {left.map((l) => (
            <button
              key={l}
              onClick={() => selectLeft(l)}
              className={[
                "w-full text-left px-3 py-2 rounded-lg border",
                selectedLeft === l ? "bg-blue-50 border-blue-300" : "bg-white",
              ].join(" ")}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {right.map((r) => (
            <button
              key={r}
              onClick={() => pickRight(r)}
              disabled={usedRight.has(r)}
              className={[
                "w-full text-left px-3 py-2 rounded-lg border",
                usedRight.has(r) ? "bg-slate-100 text-slate-400" : "bg-white",
              ].join(" ")}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {pairs.length > 0 && (
        <div className="bg-white rounded-lg border p-3">
          <div className="text-sm font-semibold mb-2">Құрастырылған жұптар</div>
          <ul className="text-sm space-y-1">
            {pairs.map((p, idx) => (
              <li key={idx}>
                {p.left} → {p.right}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm"
        >
          Тексеру
        </button>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-md border text-sm"
        >
          Қайта бастау
        </button>
      </div>

      {resultMsg && <div className="text-sm">{resultMsg}</div>}
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
