import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTemplate } from "../../api/templates";

type OptionRow = {
  id: string;
  text: string;
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function QuizCreate() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("Quiz: Дерекқор негіздері");
  const [question, setQuestion] = useState("Primary Key не үшін қажет?");
  const [options, setOptions] = useState<OptionRow[]>([
    { id: makeId(), text: "Кестедегі жазбаны бірегей анықтау үшін" },
    { id: makeId(), text: "Кестені автоматты өшіру үшін" },
    { id: makeId(), text: "Тек дизайн үшін" },
    { id: makeId(), text: "Индексті жасыру үшін" },
  ]);
  const [correctIndex, setCorrectIndex] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const cleanOptions = useMemo(
    () => options.map((o) => o.text.trim()).filter(Boolean),
    [options]
  );

  const canSave =
    title.trim().length > 0 &&
    question.trim().length > 0 &&
    cleanOptions.length >= 2 &&
    correctIndex >= 0 &&
    correctIndex < options.length &&
    options[correctIndex]?.text.trim().length > 0;

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, text: value } : o)));
  };

  const addOption = () => {
    setOptions((prev) => [...prev, { id: makeId(), text: "" }]);
  };

  const removeOption = (index: number) => {
    setOptions((prev) => {
      if (prev.length <= 2) return prev;
      const next = prev.filter((_, i) => i !== index);
      if (correctIndex >= next.length) setCorrectIndex(Math.max(0, next.length - 1));
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCreatedId(null);

    if (!canSave) {
      setError("Барлық міндетті өрістерді дұрыс толтырыңыз.");
      return;
    }

    const payload = {
      title: title.trim(),
      template_type: "quiz" as const,
      data: {
        question: question.trim(),
        options: cleanOptions,
        answer: options[correctIndex].text.trim(),
      },
    };

    try {
      setSaving(true);
      const created = await createTemplate(payload);
      setSuccess("Викторина сәтті сақталды ✅");
      setCreatedId(created.id);
    } catch (e: any) {
      console.error(e);
      setError(
        e?.response?.data?.detail ||
          e?.response?.data?.data ||
          "Сақтау кезінде қате болды."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 p-4 md:p-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Quiz Builder</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Жаңа викторина құру</h1>
        <p className="mt-2 text-sm text-slate-600">
          Бұл форма `quiz template` жасайды. Сақталғаннан кейін ол бірден `/game/quiz` тізімінде көрінеді.
        </p>
      </section>

      <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-4 md:p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Викторина атауы</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="Мысалы: SQL негіздері"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Сұрақ</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="Сұрақ мәтіні"
          />
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">Жауап нұсқалары</div>
            <button
              type="button"
              onClick={addOption}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
            >
              + Нұсқа қосу
            </button>
          </div>

          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={opt.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                <input
                  type="radio"
                  name="correct_answer"
                  checked={correctIndex === idx}
                  onChange={() => setCorrectIndex(idx)}
                  className="h-4 w-4"
                  aria-label={`Correct answer ${idx + 1}`}
                />
                <input
                  value={opt.text}
                  onChange={(e) => updateOption(idx, e.target.value)}
                  placeholder={`Жауап ${idx + 1}`}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeOption(idx)}
                  disabled={options.length <= 2}
                  className="text-xs px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50"
                >
                  Өшіру
                </button>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-slate-500">Радио арқылы дұрыс жауапты белгілеңіз.</div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={!canSave || saving}
            className="px-4 py-2.5 rounded-xl bg-black text-white text-sm disabled:opacity-50"
          >
            {saving ? "Сақталып жатыр..." : "Викторинаны сақтау"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/game/quiz")}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm hover:bg-slate-50"
          >
            Тізімге қайту
          </button>
          {createdId && (
            <button
              type="button"
              onClick={() => navigate(`/game/quiz/${createdId}`)}
              className="px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm hover:bg-emerald-100"
            >
              Қазір ашу
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {success}
          </div>
        )}
      </form>
    </div>
  );
}
