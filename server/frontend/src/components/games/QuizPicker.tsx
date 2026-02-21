import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createPresetTemplate,
  getTemplates,
  importQuizFromDocx,
  SlideTemplate,
} from "../../api/templates";

type ImportMode = "separate" | "single_quiz";

type QuizTemplateItem = {
  id: number;
  title: string;
  created_at?: string;
  data?: {
    question?: string;
    options?: string[];
    answer?: string;
    questions?: Array<{
      question?: string;
      options?: string[];
      answer?: string;
    }>;
  };
};

const QUIZ_BLOCK_STYLES = [
  {
    wrap: "border-rose-200 bg-gradient-to-br from-rose-50 to-white",
    tag: "border-rose-200 bg-rose-100 text-rose-700",
    cta: "text-rose-700 group-hover:text-rose-800",
  },
  {
    wrap: "border-blue-200 bg-gradient-to-br from-blue-50 to-white",
    tag: "border-blue-200 bg-blue-100 text-blue-700",
    cta: "text-blue-700 group-hover:text-blue-800",
  },
  {
    wrap: "border-amber-200 bg-gradient-to-br from-amber-50 to-white",
    tag: "border-amber-200 bg-amber-100 text-amber-700",
    cta: "text-amber-700 group-hover:text-amber-800",
  },
  {
    wrap: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
    tag: "border-emerald-200 bg-emerald-100 text-emerald-700",
    cta: "text-emerald-700 group-hover:text-emerald-800",
  },
];

function asQuizTemplate(item: SlideTemplate): QuizTemplateItem | null {
  if (item.template_type !== "quiz") return null;
  return {
    id: item.id,
    title: item.title || `Quiz #${item.id}`,
    created_at: item.created_at,
    data: item.data || {},
  };
}

function formatDate(value?: string) {
  if (!value) return "Күні жоқ";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Күні жоқ";
  return d.toLocaleDateString("kk-KZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getQuestionCount(item: QuizTemplateItem) {
  const list = item.data?.questions;
  if (Array.isArray(list) && list.length) return list.length;
  return item.data?.question ? 1 : 0;
}

function getPreviewQuestion(item: QuizTemplateItem) {
  const list = item.data?.questions;
  if (Array.isArray(list) && list.length) {
    const first = list.find((q) => (q?.question || "").trim().length > 0);
    return first?.question || "";
  }
  return item.data?.question || "";
}

function getAverageOptionsPerQuestion(item: QuizTemplateItem) {
  const list = item.data?.questions;
  if (Array.isArray(list) && list.length) {
    const total = list.reduce((acc, q) => acc + (q?.options?.length || 0), 0);
    return Math.round((total / list.length) * 10) / 10;
  }
  return item.data?.options?.length || 0;
}

export default function QuizPicker() {
  const [items, setItems] = useState<QuizTemplateItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingPreset, setCreatingPreset] = useState(false);
  const [importingDocx, setImportingDocx] = useState(false);
  const [importTitle, setImportTitle] = useState("Word Quiz");
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("separate");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getTemplates();
      const quizzes = list
        .map(asQuizTemplate)
        .filter((x): x is QuizTemplateItem => Boolean(x))
        .sort((a, b) => b.id - a.id);
      setItems(quizzes);
      setImportMsg(null);
    } catch (e) {
      console.error(e);
      setError("Викториналарды жүктеу кезінде қате болды.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const question = getPreviewQuestion(item);
      const multiQuestionBlob = (item.data?.questions || [])
        .map((row) => row?.question || "")
        .join(" ");
      return (
        item.title.toLowerCase().includes(q) ||
        question.toLowerCase().includes(q) ||
        multiQuestionBlob.toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  const avgOptions = useMemo(() => {
    if (!items.length) return 0;
    const total = items.reduce((acc, item) => acc + getAverageOptionsPerQuestion(item), 0);
    return Math.round((total / items.length) * 10) / 10;
  }, [items]);

  const onCreatePreset = async () => {
    try {
      setCreatingPreset(true);
      setError(null);
      await createPresetTemplate({
        template_type: "quiz",
        title: "Quiz: База данных (жылдам пресет)",
      });
      await load();
    } catch (e) {
      console.error(e);
      setError("Preset викторина құру кезінде қате болды.");
    } finally {
      setCreatingPreset(false);
    }
  };

  const onImportDocx = async () => {
    if (!docxFile) {
      setError("Word (.docx) файлын таңдаңыз.");
      return;
    }
    try {
      setImportingDocx(true);
      setError(null);
      const res = await importQuizFromDocx(
        docxFile,
        importTitle.trim() || "Word Quiz",
        importMode
      );
      await load();
      const warnings = (res.warnings || []).slice(0, 2);
      const modeLabel =
        res.mode === "single_quiz"
          ? "бір multi-question quiz"
          : `${res.created_count} жеке quiz`;
      setImportMsg(
        warnings.length
          ? `Импорт сәтті: ${modeLabel}. Ескерту: ${warnings.join(" | ")}`
          : `Импорт сәтті: ${modeLabel}. Сұрақ саны: ${res.questions_detected ?? res.created_count}.`
      );
      setDocxFile(null);
    } catch (e: any) {
      console.error(e);
      setError(
        e?.response?.data?.error ||
          e?.response?.data?.detail ||
          "Word импорт кезінде қате болды."
      );
    } finally {
      setImportingDocx(false);
    }
  };

  return (
    <div className="space-y-5 quiz-hub">
      <section className="hub-hero kz-ornament-card relative overflow-hidden">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-amber-200/40 blur-3xl" />

        <div className="relative hub-hero__wrap">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">QUIZ HUB</div>
            <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
              Викторина кітапханасы
            </h1>
            <p className="mt-2 text-sm md:text-base text-slate-600">
              Дайын викторинаны таңдап, бірден оқушыға беруге болады.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/game/quiz/create"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold border border-slate-900 shadow-sm hover:bg-slate-800"
              >
                + Жаңа викторина
              </Link>
              <button
                type="button"
                onClick={onCreatePreset}
                disabled={creatingPreset}
                className="px-4 py-2 rounded-xl border-2 border-slate-300 bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
              >
                {creatingPreset ? "..." : "Жылдам preset"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs">Quiz</span>
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs">Word import</span>
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs">Single/Multi</span>
            </div>
          </div>

          <div className="hub-hero__stats sm:grid sm:grid-cols-2 lg:grid-cols-1">
            <div className="hub-stat">
              <div className="hub-stat__num">{items.length}</div>
              <div className="hub-stat__label">Барлық шаблон</div>
            </div>
            <div className="hub-stat">
              <div className="hub-stat__num">{Math.round(avgOptions * 10) / 10}</div>
              <div className="hub-stat__label">Орташа жауап саны</div>
            </div>
            <div className="hub-stat">
              <div className="hub-stat__num">{filtered.length}</div>
              <div className="hub-stat__label">Іріктелген нәтиже</div>
            </div>
          </div>
        </div>
      </section>

      <div className="hub-grid">
        <aside className="hub-side space-y-3">
          <div className="text-base font-semibold text-slate-900">Қосымша</div>

          <input
            value={importTitle}
            onChange={(e) => setImportTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            placeholder="Импорт атауы"
          />
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setDocxFile(e.target.files?.[0] || null)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={onImportDocx}
            disabled={importingDocx}
            className="w-full px-4 py-2 rounded-xl border border-sky-300 bg-sky-50 text-sky-900 text-sm font-medium hover:bg-sky-100 disabled:opacity-60"
          >
            {importingDocx ? "Импорт..." : "Word-тан импорт"}
          </button>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setImportMode("separate")}
              className={`w-full px-3 py-2 rounded-xl text-xs border ${
                importMode === "separate"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-600"
              }`}
            >
              Әр сұрақ жеке quiz
            </button>
            <button
              type="button"
              onClick={() => setImportMode("single_quiz")}
              className={`w-full px-3 py-2 rounded-xl text-xs border ${
                importMode === "single_quiz"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-600"
              }`}
            >
              Бір quiz ішінде көп сұрақ
            </button>
          </div>

          <div className="text-[11px] text-slate-500">
            Формат: `1) ... A) ... B) ... C) ... Дұрыс жауап: A`
          </div>
          {importMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
              {importMsg}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </aside>

        <section className="hub-section">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-2xl font-semibold text-slate-900">Quiz шаблондар</div>
              <div className="text-xs text-slate-500">Бір батырмамен қосылады</div>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Іздеу (атауы, сұрақ мәтіні)"
              className="w-full md:w-80 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>

          {loading && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Викториналар жүктелуде...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="text-base font-semibold text-slate-900">Quiz табылмады</div>
              <div className="text-sm text-slate-500 mt-1">Жаңа викторина құрып немесе preset қосып көріңіз.</div>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((quiz, idx) => {
                const style = QUIZ_BLOCK_STYLES[idx % QUIZ_BLOCK_STYLES.length];
                return (
                  <Link
                    key={quiz.id}
                    to={`/game/quiz/${quiz.id}`}
                    className={`kz-ornament-card group block rounded-2xl border p-4 shadow-sm transition hover:-translate-y-[2px] hover:shadow-md ${style.wrap}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900 line-clamp-2">
                        {quiz.title}
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${style.tag}`}>
                        quiz
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-slate-600 line-clamp-2 min-h-[34px]">
                      {getPreviewQuestion(quiz) || "Сұрақ мәтіні көрсетілмеген."}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span>Сұрақ: {getQuestionCount(quiz)}</span>
                      <span>Орташа жауап: {getAverageOptionsPerQuestion(quiz)}</span>
                      <span>{formatDate(quiz.created_at)}</span>
                    </div>

                    <div className={`mt-3 text-sm font-semibold ${style.cta}`}>Ашу →</div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
