// src/components/games/QuizGame.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { createSubmission } from "../../api/slide";
import { resolveNextAssignmentPath } from "../../services/assignmentFlow";

type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
};

const OPTION_TONES = [
  { tone: "bg-rose-500 border-rose-700 hover:bg-rose-600", text: "text-white", marker: "▲" },
  { tone: "bg-blue-600 border-blue-800 hover:bg-blue-700", text: "text-white", marker: "■" },
  { tone: "bg-amber-400 border-amber-600 hover:bg-amber-500", text: "text-slate-900", marker: "●" },
  { tone: "bg-emerald-600 border-emerald-800 hover:bg-emerald-700", text: "text-white", marker: "◆" },
];

type QuizTemplate = {
  id: number;
  title: string;
  template_type: string;
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

export default function QuizGame() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const templateId = Number(id);
  const assignmentId = Number(searchParams.get("assignment")) || null;

  const [tpl, setTpl] = useState<QuizTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Array<string | null>>([]);
  const [details, setDetails] = useState<Array<{ index: number; correct: boolean }> | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const startedAtRef = useRef(Date.now());
  const currentRole = localStorage.getItem("role");
  const isTeacherPreview = currentRole === "teacher";

  const questions = useMemo<QuizQuestion[]>(() => {
    const cfg = tpl?.data || {};
    if (Array.isArray(cfg.questions) && cfg.questions.length) {
      return cfg.questions
        .map((row) => {
          const question = (row?.question || "").trim();
          const options = Array.isArray(row?.options)
            ? row.options.map((opt) => String(opt || "").trim()).filter(Boolean)
            : [];
          const answer = String(row?.answer || "").trim();
          if (!question || options.length < 2) return null;
          return { question, options, answer };
        })
        .filter((row): row is QuizQuestion => Boolean(row));
    }
    const singleQuestion = String(cfg.question || "").trim();
    const singleOptions = Array.isArray(cfg.options)
      ? cfg.options.map((opt) => String(opt || "").trim()).filter(Boolean)
      : [];
    if (!singleQuestion || singleOptions.length < 2) return [];
    return [
      {
        question: singleQuestion,
        options: singleOptions,
        answer: String(cfg.answer || "").trim(),
      },
    ];
  }, [tpl]);

  useEffect(() => {
    if (!templateId) return;
    setLoading(true);
    setError(null);
    api
      .get(`/slide/templates/${templateId}/`)
      .then((res) => {
        setTpl(res.data);
      })
      .catch((err) => {
        console.error("Quiz load error:", err);
        setError("Викторинаны жүктеу кезінде қате болды.");
      })
      .finally(() => setLoading(false));
  }, [templateId]);

  useEffect(() => {
    setSelectedAnswers(questions.map(() => null));
    setSubmitError(null);
    setResultMsg(null);
    setDetails(null);
    setNextPath(null);
    startedAtRef.current = Date.now();
  }, [templateId, questions.length]);

  const allAnswered = selectedAnswers.length > 0 && selectedAnswers.every((v) => Boolean(v));
  const answerLocked = Boolean(resultMsg);

  const setAnswer = (questionIndex: number, answer: string) => {
    setSelectedAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = answer;
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setResultMsg(null);
    setDetails(null);

    if (!allAnswered) {
      setSubmitError("Барлық сұраққа жауап беріңіз.");
      return;
    }

    const resolvedAnswers = selectedAnswers.map((a) => String(a || ""));
    const localDetails = questions.map((q, i) => ({
      index: i + 1,
      correct:
        String(resolvedAnswers[i] || "").trim().toLowerCase() ===
        String(q.answer || "").trim().toLowerCase(),
    }));

    if (isTeacherPreview) {
      const correctCount = localDetails.filter((d) => d.correct).length;
      const total = questions.length;
      const percent = total ? Math.round((correctCount / total) * 100) : 0;
      setDetails(localDetails);
      setResultMsg(`Preview: дұрыс ${correctCount}/${total} (${percent}%)`);
      return;
    }

    try {
      setSubmitting(true);
      const durationSeconds = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
      const submissionPayload =
        questions.length > 1
          ? { answers: resolvedAnswers }
          : { answer: resolvedAnswers[0] };

      const res = await createSubmission({
        template: templateId,
        data: submissionPayload,
        duration_seconds: durationSeconds,
      });
      const path = await resolveNextAssignmentPath(assignmentId);
      setNextPath(path);

      if (questions.length > 1) {
        const correctCount = Number(res?.correct_count);
        const totalQuestions = Number(res?.total_questions) || questions.length;
        const safeCorrect = Number.isFinite(correctCount)
          ? correctCount
          : localDetails.filter((d) => d.correct).length;
        const percent = totalQuestions ? Math.round((safeCorrect / totalQuestions) * 100) : 0;
        setResultMsg(`Нәтиже: ${safeCorrect}/${totalQuestions} (${percent}%)`);
        if (Array.isArray(res?.details)) {
          setDetails(
            res.details.map((d: any) => ({
              index: Number(d?.index) || 0,
              correct: Boolean(d?.correct),
            }))
          );
        } else {
          setDetails(localDetails);
        }
      } else {
        const correct = Boolean(res?.correct);
        const correctAnswer = questions[0]?.answer || "-";
        setResultMsg(correct ? "Дұрыс жауап ✅" : `Дұрыс жауап: ${correctAnswer}`);
      }
    } catch (e) {
      console.error("Submit error:", e);
      setSubmitError("Жауапты жіберу кезінде қате болды.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Жүктелуде...</div>;
  if (error) return <div>{error}</div>;
  if (!tpl || questions.length === 0) {
    return <div>Сұрақ табылмады.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto py-6">
      <h1 className="text-3xl font-bold mb-4">
        {tpl.title} 🧠
      </h1>

      <div className="kz-ornament-card bg-white/95 rounded-2xl border border-amber-200/70 shadow-[0_12px_30px_rgba(15,23,42,0.08)] p-4 mb-4">
        {isTeacherPreview && (
          <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
            Preview mode: бұл жерде студент submission жіберілмейді.
          </div>
        )}
        <div className="space-y-4">
          {questions.map((q, qIdx) => (
            <div key={qIdx} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
              <div className="font-medium mb-3">
                {qIdx + 1}. {q.question}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.options.map((answer, idx) => {
                  const isPicked = selectedAnswers[qIdx] === answer;
                  const detail = details?.find((d) => d.index === qIdx + 1);
                  const tone = OPTION_TONES[idx % OPTION_TONES.length];
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (!answerLocked) setAnswer(qIdx, answer);
                      }}
                      className={`w-full min-h-[64px] text-left border-2 rounded-xl px-3 py-3 transition shadow-sm ${
                        tone.tone
                      } ${tone.text} ${
                        isPicked
                          ? "ring-4 ring-white/70 scale-[1.01]"
                          : "opacity-95"
                      } ${answerLocked ? "cursor-default" : ""}`}
                      disabled={answerLocked}
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/20 text-xs font-bold">
                          {tone.marker}
                        </span>
                        <span className="text-sm font-semibold leading-snug">
                          {answer || "Жауап мәтіні бос"}
                        </span>
                        {detail && isPicked && (
                          <span className={`ml-auto text-xs font-bold ${detail.correct ? "text-emerald-100" : "text-rose-100"}`}>
                            {detail.correct ? "✓" : "✗"}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAnswered || submitting || answerLocked}
          className="px-4 py-2 rounded-xl text-sm text-white bg-gradient-to-r from-blue-600 via-cyan-500 to-rose-500 disabled:opacity-60"
        >
          {isTeacherPreview
            ? "Preview тексеру"
            : submitting
              ? "Жіберілуде..."
              : questions.length > 1
                ? "Нәтижені жіберу"
                : "Жауапты жіберу"}
        </button>
        {answerLocked && (
          <button
            type="button"
            onClick={() => {
              setSelectedAnswers(questions.map(() => null));
              setSubmitError(null);
              setResultMsg(null);
              setDetails(null);
              setNextPath(null);
              startedAtRef.current = Date.now();
            }}
            className="px-4 py-2 rounded-xl text-sm border border-slate-300 bg-white hover:bg-slate-50"
          >
            Қайта бастау
          </button>
        )}
      </div>

      {submitError && <div className="text-sm text-rose-600 mt-2">{submitError}</div>}
      {resultMsg && (
        <div className="text-sm text-slate-700 mt-2 rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2">
          {resultMsg}
        </div>
      )}
      {nextPath && (
        <button
          type="button"
          onClick={() => navigate(nextPath)}
          className="mt-2 px-4 py-2 rounded-xl border border-slate-300 text-sm bg-white hover:bg-slate-50"
        >
          Келесі тапсырма
        </button>
      )}
    </div>
  );
}
