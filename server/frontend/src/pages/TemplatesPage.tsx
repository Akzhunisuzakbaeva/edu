import { useEffect, useRef, useState } from "react";
import {
  listTemplates,
  createTemplatePreset,
  createTemplate,
  applyTemplate,
  type SlideTemplate,
  type TemplateType,
} from "../api/templates";
import api from "../api/axios";

const PRESETS: { type: TemplateType; label: string }[] = [
  { type: "quiz", label: "➕ Quiz: Қысқа тест" },
  { type: "matching", label: "➕ Matching: Сәйкестендіру" },
  { type: "flashcards", label: "➕ Карточкалар: Терминдер" },
  { type: "poll", label: "➕ Poll: Дауыс беру" },
  { type: "crossword", label: "➕ Сөзжұмбақ: Терминдер" },
  { type: "sorting", label: "➕ Sorting: Ретімен қою" },
  { type: "grouping", label: "➕ Grouping: Топтау" },
];

type Pair = { left: string; right: string };
type Group = { title: string; items: string[] };
type Flashcard = { front: string; back: string };
type CrosswordEntry = { clue: string; answer: string };
type Lesson = { id: number; title: string };

export default function TemplatesPage() {
  const supportedTypes = new Set<TemplateType>([
    "quiz",
    "poll",
    "matching",
    "sorting",
    "grouping",
    "flashcards",
    "crossword",
  ]);
  const [items, setItems] = useState<SlideTemplate[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<TemplateType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState<TemplateType>("quiz");
  const [newTitle, setNewTitle] = useState("Quiz: Дерекқор негіздері");
  const [query, setQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [presetMsg, setPresetMsg] = useState<string | null>(null);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [activePreset, setActivePreset] = useState<TemplateType | null>(null);
  const inlineFormRef = useRef<HTMLDivElement | null>(null);
  const [attachLessonId, setAttachLessonId] = useState<number | "">("");
  const [attachTemplateId, setAttachTemplateId] = useState<number | "">("");
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachMsg, setAttachMsg] = useState<string | null>(null);

  // Quiz
  const [quizQuestion, setQuizQuestion] = useState("Біріншілік кілт (Primary Key) не үшін керек?");
  const [quizOptions, setQuizOptions] = useState<string[]>([
    "Жазбаны бірегей анықтау үшін",
    "Кестені суретпен безендіру үшін",
    "Кестені жою үшін",
    "SQL синтаксисін сақтау үшін",
  ]);
  const [quizAnswer, setQuizAnswer] = useState("Жазбаны бірегей анықтау үшін");

  // Poll
  const [pollQuestion, setPollQuestion] = useState("Қай SQL командасын жиі қолданасыз?");
  const [pollOptions, setPollOptions] = useState<string[]>([
    "SELECT",
    "INSERT",
    "UPDATE",
    "DELETE",
  ]);

  // Matching
  const [pairs, setPairs] = useState<Pair[]>([
    { left: "SELECT", right: "Деректерді оқу" },
    { left: "INSERT", right: "Жазба қосу" },
    { left: "UPDATE", right: "Жазбаны өзгерту" },
    { left: "DELETE", right: "Жазбаны жою" },
  ]);

  // Sorting
  const [sortingItems, setSortingItems] = useState<string[]>([
    "1) Қажетті кестені таңдау",
    "2) SELECT өрістерін анықтау",
    "3) WHERE шартын жазу",
    "4) Сұранысты орындау",
  ]);

  // Grouping
  const [groups, setGroups] = useState<Group[]>([
    {
      title: "Реляциялық дерекқор",
      items: ["Кесте (Table)", "Жол (Row)", "Баған (Column)"],
    },
    {
      title: "SQL командалары",
      items: ["SELECT — оқу", "INSERT — қосу", "UPDATE — өзгерту"],
    },
  ]);

  // Flashcards
  const [flashcards, setFlashcards] = useState<Flashcard[]>([
    { front: "Primary Key", back: "Жазбаны бірегей анықтайтын кілт" },
    { front: "Foreign Key", back: "Басқа кестеге сілтеме" },
    { front: "Index", back: "Іздеуді жылдамдататын құрылым" },
  ]);

  // Crossword
  const [crosswordEntries, setCrosswordEntries] = useState<CrosswordEntry[]>([
    { clue: "Кестені сипаттайтын құрылым", answer: "SCHEMA" },
    { clue: "Деректерді оқу командасы", answer: "SELECT" },
    { clue: "Жазба қосу командасы", answer: "INSERT" },
  ]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listTemplates();
      setItems(data);
      const l = await api.get("/lessons/lessons/");
      setLessons(l.data ?? []);
      if (!attachLessonId && (l.data ?? []).length) {
        setAttachLessonId((l.data ?? [])[0].id);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreatePreset = async (type: TemplateType) => {
    setBusyType(type);
    setError(null);
    setPresetMsg(null);
    try {
      const created = await createTemplatePreset({ template_type: type });
      // тізімнің басына қосамыз
      setItems((prev) => [created, ...prev]);
      setPresetMsg("Шаблон қосылды ✅");
    } catch (e: any) {
      setError(
        e?.response?.data?.error ||
          e?.response?.data?.detail ||
          e?.message ||
          "Failed to create preset"
      );
    } finally {
      setBusyType(null);
    }
  };

  const openPresetInForm = (type: TemplateType) => {
    setNewType(type);
    setNewTitle(`${String(type).toUpperCase()}: Жаңа тапсырма`);
    setShowInlineForm(true);
    setActivePreset(type);
    requestAnimationFrame(() => {
      inlineFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const onCreateCustom = async () => {
    setCreateError(null);
    if (!newTitle.trim()) {
      setCreateError("Атауын жазыңыз.");
      return;
    }
    let data: any = {};
    if (newType === "quiz") {
      if (!quizQuestion.trim() || quizOptions.filter(Boolean).length < 2) {
        setCreateError("Quiz үшін сұрақ және кемі 2 жауап керек.");
        return;
      }
      data = {
        question: quizQuestion.trim(),
        options: quizOptions.map((o) => o.trim()).filter(Boolean),
        answer: quizAnswer.trim(),
      };
    } else if (newType === "poll") {
      if (!pollQuestion.trim() || pollOptions.filter(Boolean).length < 2) {
        setCreateError("Poll үшін сұрақ және кемі 2 жауап керек.");
        return;
      }
      data = {
        question: pollQuestion.trim(),
        options: pollOptions.map((o) => o.trim()).filter(Boolean),
      };
    } else if (newType === "matching") {
      const left = pairs.map((p) => p.left.trim()).filter(Boolean);
      const right = pairs.map((p) => p.right.trim()).filter(Boolean);
      if (left.length === 0 || left.length !== right.length) {
        setCreateError("Matching үшін жұптар толтырылуы керек.");
        return;
      }
      data = { left, right };
    } else if (newType === "sorting") {
      const items = sortingItems.map((i) => i.trim()).filter(Boolean);
      if (items.length < 2) {
        setCreateError("Sorting үшін кемі 2 элемент керек.");
        return;
      }
      data = { items };
    } else if (newType === "grouping") {
      const clean = groups
        .map((g) => ({
          title: g.title.trim(),
          items: g.items.map((i) => i.trim()).filter(Boolean),
        }))
        .filter((g) => g.title && g.items.length);
      if (clean.length < 1) {
        setCreateError("Grouping үшін топтар толтырылуы керек.");
        return;
      }
      data = { groups: clean };
    } else if (newType === "flashcards") {
      const clean = flashcards
        .map((c) => ({ front: c.front.trim(), back: c.back.trim() }))
        .filter((c) => c.front && c.back);
      if (clean.length < 2) {
        setCreateError("Flashcards үшін кемі 2 карта керек.");
        return;
      }
      data = { cards: clean };
    } else if (newType === "crossword") {
      const clean = crosswordEntries
        .map((e) => ({ clue: e.clue.trim(), answer: e.answer.trim() }))
        .filter((e) => e.clue && e.answer);
      if (clean.length < 2) {
        setCreateError("Crossword үшін кемі 2 сөз керек.");
        return;
      }
      data = { entries: clean };
    } else {
      setCreateError("Бұл типке форма әлі дайын емес.");
      return;
    }
    try {
      setCreating(true);
      const created = await createTemplate({
        title: newTitle.trim(),
        template_type: newType,
        data,
      });
      setItems((prev) => [created, ...prev]);
      setAttachTemplateId(created.id);
    } catch (e: any) {
      setCreateError(
        e?.response?.data?.data ||
          e?.response?.data?.detail ||
          e?.message ||
          "Failed to create template"
      );
    } finally {
      setCreating(false);
    }
  };

  const onChangeType = (t: TemplateType) => {
    setNewType(t);
  };

  const handleAttachToLesson = async () => {
    setAttachMsg(null);
    if (!attachLessonId || !attachTemplateId) {
      setAttachMsg("Сабақ пен шаблонды таңдаңыз.");
      return;
    }
    try {
      setAttachBusy(true);
      await applyTemplate(Number(attachTemplateId), { lesson_id: attachLessonId });
      setAttachMsg("Шаблон сабаққа қосылды ✅");
    } catch (e) {
      console.error(e);
      setAttachMsg("Қосу кезінде қате болды.");
    } finally {
      setAttachBusy(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 templates-page">
      <section className="templates-hero">
        <div className="templates-hero__content">
          <div className="templates-eyebrow">Шаблондар</div>
          <h1 className="templates-title">Шаблондар кітапханасы</h1>
          <p className="templates-subtitle">
            Ойындар, тесттер, интерактивтер — сабақты тез құрастыру үшін.
          </p>
          <div className="templates-search">
            <input
              placeholder="Іздеу (мысалы: алгоритм, теңдеу)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="templates-search__input"
            />
            <button
              onClick={() => void load()}
              className="templates-btn templates-btn--ghost"
              disabled={loading}
            >
              Жаңарту
            </button>
          </div>
          <div className="templates-pills">
            <span className="templates-pill">Quiz</span>
            <span className="templates-pill">Sorting</span>
            <span className="templates-pill">Matching</span>
            <span className="templates-pill">Grouping</span>
            <span className="templates-pill">Poll</span>
          </div>
        </div>
        <div className="templates-hero__stats">
          <div className="templates-stat">
            <div className="templates-stat__num">{items.length}</div>
            <div className="templates-stat__label">Барлық шаблон</div>
          </div>
          <div className="templates-stat">
            <div className="templates-stat__num">{PRESETS.length}</div>
            <div className="templates-stat__label">Дайын пресет</div>
          </div>
          <div className="templates-stat">
            <div className="templates-stat__num">1‑2 мин</div>
            <div className="templates-stat__label">Сабақ құрастыру</div>
          </div>
        </div>
      </section>

      {/* Library */}
      <div className="templates-grid">
        <aside className="templates-side">
          <div className="templates-side__title">Қосымша</div>
          <button
            className="templates-side__btn"
            onClick={() => {
              setImportMsg(null);
              setImportFile(null);
              setShowImport(true);
            }}
          >
            📄 Импорт (PDF/PPT)
          </button>
          <button
            className="templates-side__btn"
            onClick={() => {
              setImportMsg(null);
              setImportFile(null);
              setShowImport(true);
            }}
          >
            💻 Менің компьютерім
          </button>
          <button
            className="templates-side__btn"
            onClick={() => {
              setImportMsg("Ішкі контент: дайын шаблондарды қолдана аласыз.");
            }}
          >
            🧰 Ішкі контент
          </button>
          <div className="templates-side__note">
            Қосымша материалдарды тез қосу.
          </div>
        </aside>

        <div className="templates-main">
          <div className="templates-section">
            <div className="templates-section__head">
              <div className="templates-section__title">Шаблондар</div>
              <div className="templates-section__hint">Бір батырмамен қосылады</div>
            </div>
            <div className="templates-cards">
              {PRESETS.map((p) => (
                <button
                  key={p.type}
                  type="button"
                  onClick={() => openPresetInForm(p.type)}
                  className={[
                    "templates-card",
                    activePreset === p.type ? "templates-card--active" : "",
                  ].join(" ")}
                >
                  <div className="templates-card__title">{p.label}</div>
                  <div className="templates-card__meta">Дайын шаблонды бірден қосу</div>
                  <div className="templates-card__cta">Сұрақтарды толтыру →</div>
                </button>
              ))}
            </div>
            <div ref={inlineFormRef} />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Шаблон жасау</div>
                  <button
                    type="button"
                    onClick={() => setShowInlineForm((v) => !v)}
                    className="text-xs px-2 py-1 rounded border"
                  >
                    {showInlineForm ? "Жабу" : "Ашу"}
                  </button>
                </div>

                {!showInlineForm ? (
                  <div className="text-xs text-slate-600">
                    Карточканы таңдаңыз да осы жерде сұрақтарды толтырыңыз.
                  </div>
                ) : (
                  <>
                    <div className="grid md:grid-cols-3 gap-2">
                      <input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Шаблон атауы"
                        className="border rounded-lg px-3 py-2 text-sm"
                      />
                      <div className="border rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-700">
                        Түрі: {String(newType).toUpperCase()}
                      </div>
                      <button
                        onClick={() => void onCreateCustom()}
                        disabled={creating || !supportedTypes.has(newType)}
                        className="px-3 py-2 rounded-lg bg-sky-600 text-white text-sm"
                      >
                        {creating ? "..." : "Шаблон құру"}
                      </button>
                    </div>
                    {!supportedTypes.has(newType) && (
                      <div className="p-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs">
                        Бұл типке форма әлі дайын емес. Қазір: Quiz, Poll, Matching,
                        Sorting, Grouping ғана қолдайды.
                      </div>
                    )}

                    {newType === "quiz" && (
                      <div className="space-y-2">
                        <input
                          value={quizQuestion}
                          onChange={(e) => setQuizQuestion(e.target.value)}
                          placeholder="Сұрақ"
                          className="border rounded px-3 py-2 text-sm w-full"
                        />
                        {quizOptions.map((opt, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input
                              value={opt}
                              onChange={(e) =>
                                setQuizOptions((prev) =>
                                  prev.map((p, i) => (i === idx ? e.target.value : p))
                                )
                              }
                              placeholder={`Жауап ${idx + 1}`}
                              className="border rounded px-3 py-2 text-sm flex-1"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setQuizOptions((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="px-2 py-1 rounded border text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setQuizOptions((prev) => [...prev, ""])}
                            className="px-2 py-1 rounded border text-xs"
                          >
                            + Жауап қосу
                          </button>
                          <input
                            value={quizAnswer}
                            onChange={(e) => setQuizAnswer(e.target.value)}
                            placeholder="Дұрыс жауап (мәтін)"
                            className="border rounded px-3 py-2 text-sm flex-1"
                          />
                        </div>
                      </div>
                    )}

                    {newType === "poll" && (
                      <div className="space-y-2">
                        <input
                          value={pollQuestion}
                          onChange={(e) => setPollQuestion(e.target.value)}
                          placeholder="Сұрақ"
                          className="border rounded px-3 py-2 text-sm w-full"
                        />
                        {pollOptions.map((opt, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input
                              value={opt}
                              onChange={(e) =>
                                setPollOptions((prev) =>
                                  prev.map((p, i) => (i === idx ? e.target.value : p))
                                )
                              }
                              placeholder={`Нұсқа ${idx + 1}`}
                              className="border rounded px-3 py-2 text-sm flex-1"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setPollOptions((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="px-2 py-1 rounded border text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPollOptions((prev) => [...prev, ""])}
                          className="px-2 py-1 rounded border text-xs"
                        >
                          + Нұсқа қосу
                        </button>
                      </div>
                    )}

                    {newType === "matching" && (
                      <div className="space-y-2">
                        {pairs.map((p, idx) => (
                          <div key={idx} className="grid grid-cols-2 gap-2">
                            <input
                              value={p.left}
                              onChange={(e) =>
                                setPairs((prev) =>
                                  prev.map((x, i) => (i === idx ? { ...x, left: e.target.value } : x))
                                )
                              }
                              placeholder="Сол жақ"
                              className="border rounded px-3 py-2 text-sm"
                            />
                            <div className="flex gap-2">
                              <input
                                value={p.right}
                                onChange={(e) =>
                                  setPairs((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, right: e.target.value } : x))
                                  )
                                }
                                placeholder="Оң жақ"
                                className="border rounded px-3 py-2 text-sm flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => setPairs((prev) => prev.filter((_, i) => i !== idx))}
                                className="px-2 py-1 rounded border text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPairs((prev) => [...prev, { left: "", right: "" }])}
                          className="px-2 py-1 rounded border text-xs"
                        >
                          + Жұп қосу
                        </button>
                      </div>
                    )}

                    {newType === "sorting" && (
                      <div className="space-y-2">
                        {sortingItems.map((it, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input
                              value={it}
                              onChange={(e) =>
                                setSortingItems((prev) =>
                                  prev.map((x, i) => (i === idx ? e.target.value : x))
                                )
                              }
                              placeholder={`Элемент ${idx + 1}`}
                              className="border rounded px-3 py-2 text-sm flex-1"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setSortingItems((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="px-2 py-1 rounded border text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setSortingItems((prev) => [...prev, ""])}
                          className="px-2 py-1 rounded border text-xs"
                        >
                          + Элемент қосу
                        </button>
                      </div>
                    )}

                    {newType === "grouping" && (
                      <div className="space-y-3">
                        {groups.map((g, idx) => (
                          <div key={idx} className="border rounded-lg p-2 space-y-2">
                            <div className="flex gap-2">
                              <input
                                value={g.title}
                                onChange={(e) =>
                                  setGroups((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x))
                                  )
                                }
                                placeholder="Топ атауы"
                                className="border rounded px-3 py-2 text-sm flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => setGroups((prev) => prev.filter((_, i) => i !== idx))}
                                className="px-2 py-1 rounded border text-xs"
                              >
                                ✕
                              </button>
                            </div>
                            {(g.items || []).map((it, j) => (
                              <div key={j} className="flex gap-2">
                                <input
                                  value={it}
                                  onChange={(e) =>
                                    setGroups((prev) =>
                                      prev.map((x, i) =>
                                        i === idx
                                          ? {
                                              ...x,
                                              items: x.items.map((v, k) => (k === j ? e.target.value : v)),
                                            }
                                          : x
                                      )
                                    )
                                  }
                                  placeholder={`Элемент ${j + 1}`}
                                  className="border rounded px-3 py-2 text-sm flex-1"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setGroups((prev) =>
                                      prev.map((x, i) =>
                                        i === idx
                                          ? { ...x, items: x.items.filter((_, k) => k !== j) }
                                          : x
                                      )
                                    )
                                  }
                                  className="px-2 py-1 rounded border text-xs"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                setGroups((prev) =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, items: [...x.items, ""] } : x
                                  )
                                )
                              }
                              className="px-2 py-1 rounded border text-xs"
                            >
                              + Элемент қосу
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setGroups((prev) => [...prev, { title: "", items: [""] }])}
                          className="px-2 py-1 rounded border text-xs"
                        >
                          + Топ қосу
                        </button>
                      </div>
                    )}

                    {newType === "flashcards" && (
                      <div className="space-y-2">
                        {flashcards.map((c, idx) => (
                          <div key={idx} className="grid grid-cols-2 gap-2">
                            <input
                              value={c.front}
                              onChange={(e) =>
                                setFlashcards((prev) =>
                                  prev.map((x, i) => (i === idx ? { ...x, front: e.target.value } : x))
                                )
                              }
                              placeholder="Термин"
                              className="border rounded px-3 py-2 text-sm"
                            />
                            <div className="flex gap-2">
                              <input
                                value={c.back}
                                onChange={(e) =>
                                  setFlashcards((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, back: e.target.value } : x))
                                  )
                                }
                                placeholder="Анықтама"
                                className="border rounded px-3 py-2 text-sm flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => setFlashcards((prev) => prev.filter((_, i) => i !== idx))}
                                className="px-2 py-1 rounded border text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setFlashcards((prev) => [...prev, { front: "", back: "" }])}
                          className="px-2 py-1 rounded border text-xs"
                        >
                          + Карта қосу
                        </button>
                      </div>
                    )}

                    {newType === "crossword" && (
                      <div className="space-y-2">
                        {crosswordEntries.map((e, idx) => (
                          <div key={idx} className="grid grid-cols-2 gap-2">
                            <input
                              value={e.clue}
                              onChange={(ev) =>
                                setCrosswordEntries((prev) =>
                                  prev.map((x, i) => (i === idx ? { ...x, clue: ev.target.value } : x))
                                )
                              }
                              placeholder="Сұрақ/анықтама"
                              className="border rounded px-3 py-2 text-sm"
                            />
                            <div className="flex gap-2">
                              <input
                                value={e.answer}
                                onChange={(ev) =>
                                  setCrosswordEntries((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, answer: ev.target.value } : x))
                                  )
                                }
                                placeholder="Жауап (бір сөз)"
                                className="border rounded px-3 py-2 text-sm flex-1"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setCrosswordEntries((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="px-2 py-1 rounded border text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setCrosswordEntries((prev) => [...prev, { clue: "", answer: "" }])
                          }
                          className="px-2 py-1 rounded border text-xs"
                        >
                          + Сөз қосу
                        </button>
                      </div>
                    )}

                    {createError && (
                      <div className="p-2 rounded-lg border border-red-300 bg-red-50 text-red-700 text-xs">
                        {createError}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="rounded-xl border bg-white p-4 space-y-3">
                <div className="font-medium">Сабақ таңдау + Қосу</div>
                <div className="grid gap-2">
                  <select
                    value={attachLessonId}
                    onChange={(e) => setAttachLessonId(Number(e.target.value))}
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="" disabled>
                      Сабақ таңдаңыз
                    </option>
                    {lessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={attachTemplateId}
                    onChange={(e) => setAttachTemplateId(Number(e.target.value))}
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="" disabled>
                      Шаблон таңдаңыз
                    </option>
                    {items.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.template_type})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleAttachToLesson()}
                    disabled={attachBusy}
                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm"
                  >
                    {attachBusy ? "..." : "Сабаққа қосу"}
                  </button>
                  {attachMsg && (
                    <div className="text-xs text-slate-600">{attachMsg}</div>
                  )}
                </div>
              </div>
            </div>
            {presetMsg && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2 mt-3">
                {presetMsg}
              </div>
            )}
          </div>

          <div className="templates-section">
            <div className="templates-section__head">
              <div className="templates-section__title">Дайын ресурстар</div>
              <div className="templates-section__hint">Сабақты жылдам бастау</div>
            </div>
            <div className="templates-tiles">
              <div className="templates-tile templates-tile--amber">
                <div className="templates-tile__title">Актуализация</div>
                <div className="templates-tile__text">Білімді еске түсіру</div>
              </div>
              <div className="templates-tile templates-tile--emerald">
                <div className="templates-tile__title">Рефлексия</div>
                <div className="templates-tile__text">Қорытындылау</div>
              </div>
              <div className="templates-tile templates-tile--violet">
                <div className="templates-tile__title">Графикалық ұйымдастыру</div>
                <div className="templates-tile__text">Сызба/кесте</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl border shadow-lg w-full max-w-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Файл импорттау</div>
              <button
                onClick={() => setShowImport(false)}
                className="text-xs px-2 py-1 rounded border"
              >
                Жабу
              </button>
            </div>
            <input
              type="file"
              accept=".pdf,.ppt,.pptx"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            {importFile && (
              <div className="text-xs text-slate-600">
                Файл: <span className="font-mono">{importFile.name}</span>
              </div>
            )}
            <button
              disabled={!importFile}
              onClick={() => {
                setImportMsg("Файл қабылданды ✅ (демо)");
                setShowImport(false);
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50"
            >
              Импорттау
            </button>
          </div>
        </div>
      )}

      {importMsg && (
        <div className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2">
          {importMsg}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-700">
          {error}
        </div>
      )}

      {/* List */}
      <div className="templates-list">
        <div className="templates-list__head flex items-center justify-between gap-2">
          <span>Шаблондар {loading ? "(жүктелуде...)" : `(${items.length})`}</span>
          <a
            href="/game/quiz"
            className="text-xs rounded-full border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50"
          >
            Quiz бетіне өту
          </a>
        </div>

        {loading ? (
          <div className="p-4 text-black/60">Loading...</div>
        ) : items.length ? (
          <div className="max-h-[420px] overflow-auto divide-y">
            {items
              .filter((t) => {
                if (!query.trim()) return true;
                const q = query.toLowerCase();
                return (
                  t.title?.toLowerCase().includes(q) ||
                  String(t.template_type || "").toLowerCase().includes(q)
                );
              })
              .slice(0, showAll ? items.length : 6)
              .map((t) => (
              <div key={t.id} className="templates-list__row py-2.5">
                <div className="min-w-0">
                  <div className="templates-list__title truncate">
                    {t.title} <span className="templates-list__tag">{t.template_type}</span>
                  </div>
                  <div className="templates-list__meta">id: {t.id}</div>
                </div>

                <div className="templates-list__time shrink-0">
                  {t.created_at ? new Date(t.created_at).toLocaleString() : ""}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-black/60">Әзірге шаблон жоқ. Preset жасап көр.</div>
        )}
        {!loading && items.length > 6 && (
          <div className="p-3 border-t flex justify-center">
            <button
              onClick={() => setShowAll((v) => !v)}
              className="templates-btn templates-btn--ghost"
            >
              {showAll ? "Қысқарту" : "Барлығын көру"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
