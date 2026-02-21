import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { createSubmission } from "../../api/slide";
import { resolveNextAssignmentPath } from "../../services/assignmentFlow";

type Flashcard = { front: string; back: string };
type FlashcardsTemplate = {
  id: number;
  title: string;
  template_type: "flashcards" | string;
  data: { cards?: Flashcard[] };
};

export default function FlashcardsGame() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const templateId = Number(id);
  const assignmentId = Number(searchParams.get("assignment")) || null;
  const [tpl, setTpl] = useState<FlashcardsTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
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
        setError("Flashcards шаблонын жүктеу кезінде қате болды.");
      } finally {
        setLoading(false);
      }
    };
    if (templateId) load();
  }, [templateId]);

  if (loading) return <div>Жүктелуде...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!tpl) return <div>Flashcards табылмады.</div>;

  const cards = tpl.data?.cards || [];
  if (cards.length === 0) return <div>Карта жоқ.</div>;

  const card = cards[index];

  const submit = async (correct: boolean) => {
    try {
      const durationSeconds = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
      await createSubmission({
        template: tpl.id,
        data: { card_index: index, correct },
        duration_seconds: durationSeconds,
      });
      setMsg("Жауап сақталды ✅");
      setShowBack(false);
      if (index < cards.length - 1) {
        setIndex((i) => i + 1);
      } else {
        const path = await resolveNextAssignmentPath(assignmentId);
        setNextPath(path);
      }
    } catch (e) {
      console.error(e);
      setMsg("Жіберу кезінде қате болды.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-4">
      <h1 className="text-2xl font-bold">{tpl.title} 🧠</h1>
      <div className="text-sm text-gray-600">
        Карта {index + 1} / {cards.length}
      </div>

      <div
        className="bg-white rounded-xl shadow p-6 text-center cursor-pointer"
        onClick={() => setShowBack((v) => !v)}
      >
        <div className="text-sm text-slate-500 mb-2">
          {showBack ? "Анықтама" : "Термин"}
        </div>
        <div className="text-xl font-semibold">
          {showBack ? card.back : card.front}
        </div>
        <div className="text-xs text-slate-400 mt-2">Басып аударыңыз</div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => submit(true)}
          className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm"
        >
          Дұрыс
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          className="px-4 py-2 rounded-md bg-rose-600 text-white text-sm"
        >
          Өткізу
        </button>
      </div>

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
