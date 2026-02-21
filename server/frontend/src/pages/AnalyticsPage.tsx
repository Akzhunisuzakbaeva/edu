import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { getSubmissionMistakes, getSubmissionStats } from "../api/slide";
import { getTeacherInsights } from "../api/personalization";
import {
  autoSplitExperiment,
  assignExperimentStudents,
  createDatabaseSampleExperiment,
  createExperiment,
  downloadExperimentCsv,
  getExperimentReport,
  listExperiments,
  updateExperimentParticipant,
} from "../api/experiments";

type Lesson = { id: number; title: string };
type Assignment = {
  id: number;
  lesson: number;
  title: string;
  assignment_type?: string;
  content_id?: number | null;
};
type LeaderRow = { student_id: number; student__username: string; count: number };
type EnrollmentRow = { id: number; student: number; student_username?: string; lesson: number };
type Experiment = {
  id: number;
  lesson?: number | null;
  lesson_title?: string;
  title: string;
  focus_topic?: string;
  hypothesis?: string;
  pre_start?: string | null;
  pre_end?: string | null;
  post_start?: string | null;
  post_end?: string | null;
  participants_count?: number;
};

function toPercent(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function formatHours(seconds: any) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return "0.0";
  return (n / 3600).toFixed(1);
}

function normalizeMistakeLabel(value: any) {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  if (text === "(blank)") return "Бос ұяшық";
  return text;
}

function dateInputValue(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [lessonId, setLessonId] = useState<number | "">("");
  const [assignmentId, setAssignmentId] = useState<number | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templateIds, setTemplateIds] = useState("");
  const [slideId, setSlideId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [grouped, setGrouped] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [mistakes, setMistakes] = useState<any | null>(null);
  const [teacherInsights, setTeacherInsights] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [experimentId, setExperimentId] = useState<number | "">("");
  const [experimentReport, setExperimentReport] = useState<any | null>(null);
  const [experimentBusy, setExperimentBusy] = useState(false);
  const [experimentMessage, setExperimentMessage] = useState<string | null>(null);
  const [experimentLessonId, setExperimentLessonId] = useState<number | "">("");
  const [experimentEnrollments, setExperimentEnrollments] = useState<EnrollmentRow[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [assignGroup, setAssignGroup] = useState<"control" | "experimental">("control");
  const [expTitle, setExpTitle] = useState("База данных: бақылау vs эксперимент");
  const [expFocusTopic, setExpFocusTopic] = useState("База данных");
  const [expHypothesis, setExpHypothesis] = useState(
    "Интерактивті, адаптивті платформа қолданылған эксперименттік топтың pre/post нәтижесі бақылау тобынан жоғары болады."
  );
  const [expPreStart, setExpPreStart] = useState(dateInputValue(-14));
  const [expPreEnd, setExpPreEnd] = useState(dateInputValue(-8));
  const [expPostStart, setExpPostStart] = useState(dateInputValue(-7));
  const [expPostEnd, setExpPostEnd] = useState(dateInputValue(0));
  const [editParticipantId, setEditParticipantId] = useState<number | "">("");
  const [editPreScore, setEditPreScore] = useState("");
  const [editPostScore, setEditPostScore] = useState("");
  const [editPreMotivation, setEditPreMotivation] = useState("");
  const [editPostMotivation, setEditPostMotivation] = useState("");
  const [showOnlyActiveStudents, setShowOnlyActiveStudents] = useState(true);
  const [showBlankCrosswordMistakes, setShowBlankCrosswordMistakes] = useState(false);

  useEffect(() => {
    const loadLists = async () => {
      try {
        const [l, a] = await Promise.all([
          api.get("/lessons/lessons/"),
          api.get("/lessons/assignments/"),
        ]);
        setLessons(l.data ?? []);
        setAssignments(a.data ?? []);
        if ((l.data ?? []).length && !lessonId) {
          setLessonId((l.data ?? [])[0].id);
        }
        await loadExperiments();
      } catch (e) {
        // ignore list errors; analytics can still work by manual ID
        console.error(e);
      }
    };
    void loadLists();
  }, [lessonId]);

  useEffect(() => {
    if (!experimentId) return;
    void loadExperimentReportById(Number(experimentId));
  }, [experimentId]);

  const lessonAssignments = useMemo(() => {
    if (!lessonId) return assignments;
    return assignments.filter((a) => a.lesson === lessonId);
  }, [assignments, lessonId]);

  const loadExperiments = async (preferredId?: number) => {
    try {
      const data = await listExperiments();
      const rows: Experiment[] = data ?? [];
      setExperiments(rows);
      const selectedId = preferredId ?? (experimentId || rows[0]?.id || "");
      if (selectedId) {
        setExperimentId(Number(selectedId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadExperimentEnrollments = async (targetLessonId?: number | null) => {
    if (!targetLessonId) {
      setExperimentEnrollments([]);
      return;
    }
    try {
      const res = await api.get(`/lessons/enrollments/?lesson=${targetLessonId}`);
      setExperimentEnrollments(res.data ?? []);
    } catch (e) {
      console.error(e);
      setExperimentEnrollments([]);
    }
  };

  const loadExperimentReportById = async (id: number) => {
    try {
      setExperimentBusy(true);
      const data = await getExperimentReport(id);
      setExperimentReport(data);
      setEditParticipantId("");
      const lessonForExperiment = data?.experiment?.lesson;
      setExperimentLessonId(lessonForExperiment || "");
      await loadExperimentEnrollments(lessonForExperiment);
    } catch (e) {
      console.error(e);
      setExperimentReport(null);
      setExperimentMessage("Эксперимент есебі жүктелмеді.");
    } finally {
      setExperimentBusy(false);
    }
  };

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      try {
        const insightData = await getTeacherInsights({
          lesson: lessonId ? Number(lessonId) : undefined,
        });
        setTeacherInsights(insightData);
      } catch (insightError) {
        console.error(insightError);
        setTeacherInsights(null);
      }

      if (templateIds.trim()) {
        const ids = templateIds
          .split(",")
          .map((x) => Number(x.trim()))
          .filter((x) => Number.isFinite(x));
        if (!ids.length) {
          setError("Template ID тізімін дұрыс енгізіңіз.");
          setLoading(false);
          return;
        }
        const data = await Promise.all(
          ids.map((id) => getSubmissionStats({ template: id, from: dateFrom || undefined, to: dateTo || undefined }))
        );
        setGrouped(data);
        setResult(null);
        setLoading(false);
        return;
      }
      const t = templateId ? Number(templateId) : undefined;
      const s = slideId ? Number(slideId) : undefined;
      if (!t && !s) {
        setError("Template ID, Template IDs немесе Slide ID енгізіңіз.");
        setLoading(false);
        return;
      }
      const data = await getSubmissionStats({ template: t, slide: s, from: dateFrom || undefined, to: dateTo || undefined });
      setResult(data);
      setGrouped([]);
      if (
        data?.type &&
        ["quiz", "poll", "matching", "sorting", "grouping", "flashcards", "crossword"].includes(
          data.type
        )
      ) {
        try {
          const m = await getSubmissionMistakes({
            template: t,
            slide: s,
            from: dateFrom || undefined,
            to: dateTo || undefined,
          });
          setMistakes(m);
        } catch (e) {
          setMistakes(null);
        }
      } else {
        setMistakes(null);
      }
      // load leaderboard (optional)
      try {
        const lb = await api.get("/lessons/rewards/leaderboard/");
        setLeaderboard(lb.data ?? []);
      } catch (e) {
        // leaderboard is optional
        setLeaderboard([]);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.response?.data?.detail || e?.message || "Қате болды");
    } finally {
      setLoading(false);
    }
  };

  const handlePickAssignment = (id: number | "") => {
    setAssignmentId(id);
    const a = assignments.find((x) => x.id === id);
    if (a?.content_id) {
      setTemplateId(String(a.content_id));
      setTemplateIds("");
      setSlideId("");
    }
  };

  const exportCsv = () => {
    const rows: string[][] = [];
    if (result) {
      rows.push(["type", String(result.type)]);
      rows.push(["total", String(result.total ?? "")]);
      if (result.correct != null) rows.push(["correct", String(result.correct)]);
      if (Array.isArray(result.results)) {
        rows.push([]);
        rows.push(["value", "count", "percentage"]);
        result.results.forEach((r: any) => {
          rows.push([String(r.option ?? r.value ?? ""), String(r.count ?? ""), String(Math.round(r.percentage ?? 0))]);
        });
      }
    }
    if (grouped.length) {
      rows.push([]);
      rows.push(["template", "type", "total", "correct", "correct_%"]);
      grouped.forEach((g: any) => {
        rows.push([
          String(g.template ?? ""),
          String(g.type ?? ""),
          String(g.total ?? ""),
          String(g.correct ?? ""),
          String(Math.round(g.correct_percentage ?? 0)),
        ]);
      });
    }
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "analytics.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateExperiment = async () => {
    if (!expTitle.trim()) {
      setExperimentMessage("Эксперимент атауын енгізіңіз.");
      return;
    }
    try {
      setExperimentBusy(true);
      setExperimentMessage(null);
      const payload = await createExperiment({
        lesson: experimentLessonId ? Number(experimentLessonId) : null,
        title: expTitle.trim(),
        focus_topic: expFocusTopic.trim() || "База данных",
        hypothesis: expHypothesis.trim(),
        pre_start: expPreStart || undefined,
        pre_end: expPreEnd || undefined,
        post_start: expPostStart || undefined,
        post_end: expPostEnd || undefined,
      });
      await loadExperiments(payload?.id);
      if (payload?.id) {
        await loadExperimentReportById(payload.id);
      }
      setExperimentMessage("Эксперимент құрылды ✅");
    } catch (e: any) {
      console.error(e);
      setExperimentMessage(e?.response?.data?.detail || "Эксперимент құру кезінде қате болды.");
    } finally {
      setExperimentBusy(false);
    }
  };

  const handleCreateSampleExperiment = async () => {
    try {
      setExperimentBusy(true);
      setExperimentMessage(null);
      const payload = await createDatabaseSampleExperiment({
        lesson_id: lessonId ? Number(lessonId) : undefined,
      });
      await loadExperiments(payload?.id);
      if (payload?.id) {
        await loadExperimentReportById(payload.id);
      }
      setExperimentMessage("DB sample эксперименті құрылды ✅");
    } catch (e: any) {
      console.error(e);
      setExperimentMessage(e?.response?.data?.detail || "Sample эксперимент құруда қате болды.");
    } finally {
      setExperimentBusy(false);
    }
  };

  const toggleStudentSelection = (studentId: number) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleAssignStudents = async () => {
    if (!experimentId) {
      setExperimentMessage("Алдымен эксперимент таңдаңыз.");
      return;
    }
    if (!selectedStudents.length) {
      setExperimentMessage("Кемі 1 студент таңдаңыз.");
      return;
    }
    try {
      setExperimentBusy(true);
      setExperimentMessage(null);
      await assignExperimentStudents(Number(experimentId), {
        group: assignGroup,
        students: selectedStudents,
      });
      await loadExperimentReportById(Number(experimentId));
      setSelectedStudents([]);
      setExperimentMessage("Студенттер топқа қосылды ✅");
    } catch (e: any) {
      console.error(e);
      setExperimentMessage(e?.response?.data?.detail || "Студенттерді қосуда қате болды.");
    } finally {
      setExperimentBusy(false);
    }
  };

  const handleAutoSplit = async () => {
    if (!experimentId) {
      setExperimentMessage("Алдымен эксперимент таңдаңыз.");
      return;
    }
    try {
      setExperimentBusy(true);
      setExperimentMessage(null);
      const payload = await autoSplitExperiment(Number(experimentId), { reset_existing: true });
      await loadExperimentReportById(Number(experimentId));
      setSelectedStudents([]);
      setExperimentMessage(
        `Auto split орындалды ✅ Control: ${payload?.control ?? 0}, Experimental: ${payload?.experimental ?? 0}`
      );
    } catch (e: any) {
      console.error(e);
      setExperimentMessage(e?.response?.data?.detail || "Auto split кезінде қате болды.");
    } finally {
      setExperimentBusy(false);
    }
  };

  const handleExperimentCsvExport = async () => {
    if (!experimentId) {
      setExperimentMessage("CSV үшін эксперимент таңдаңыз.");
      return;
    }
    try {
      const blob = await downloadExperimentCsv(Number(experimentId));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `experiment_${experimentId}_report.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      setExperimentMessage(e?.response?.data?.detail || "CSV экспорт кезінде қате болды.");
    }
  };

  const handleExperimentPdfExport = () => {
    if (!experimentReport?.summary) {
      setExperimentMessage("PDF үшін эксперимент есебін жүктеңіз.");
      return;
    }
    const exp = experimentReport.experiment || {};
    const summary = experimentReport.summary || {};
    const groups = experimentReport.groups || {};
    const participants = Array.isArray(experimentReport.participants) ? experimentReport.participants : [];

    const esc = (value: any) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const rowsHtml = participants
      .map(
        (p: any) => `
          <tr>
            <td>${esc(p.student_username)}</td>
            <td>${esc(p.group)}</td>
            <td>${esc(p.pre_score)}</td>
            <td>${esc(p.post_score)}</td>
            <td>${esc(p.improvement)}</td>
            <td>${esc(p.pre_motivation)}</td>
            <td>${esc(p.post_motivation)}</td>
            <td>${esc(p.motivation_delta)}</td>
          </tr>`
      )
      .join("");

    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Experiment Report</title>
    <style>
      body { font-family: "Times New Roman", serif; padding: 24px; color: #111; }
      h1,h2 { margin: 0 0 10px 0; }
      .meta { margin-bottom: 16px; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
      th, td { border: 1px solid #333; padding: 6px; text-align: left; }
      .section { margin-top: 18px; }
      .box { border: 1px solid #333; padding: 10px; }
    </style>
  </head>
  <body>
    <h1>Dissertation Experiment Report</h1>
    <div class="meta">
      <div><b>Title:</b> ${esc(exp.title)}</div>
      <div><b>Focus:</b> ${esc(summary.focus_topic || exp.focus_topic || "База данных")}</div>
      <div><b>Hypothesis:</b> ${esc(exp.hypothesis)}</div>
      <div><b>Pre window:</b> ${esc(summary.pre_window?.start)} - ${esc(summary.pre_window?.end)}</div>
      <div><b>Post window:</b> ${esc(summary.post_window?.start)} - ${esc(summary.post_window?.end)}</div>
    </div>

    <div class="section box">
      <h2>Group Comparison (Control vs Experimental)</h2>
      <div><b>Difference-in-differences:</b> ${esc(summary.difference_in_differences)}</div>
      <div><b>P-value (approx):</b> ${esc(summary.p_value_approx)}</div>
      <div><b>Effect size (Cohen's d):</b> ${esc(summary.effect_size_cohens_d)}</div>
      <div><b>95% CI:</b> [${esc(summary.ci95_low)}; ${esc(summary.ci95_high)}]</div>
      <div><b>Statistically significant:</b> ${esc(summary.is_statistically_significant)}</div>
      <div><b>Stat method:</b> ${esc(summary.stat_method)}</div>
      <div><b>Conclusion:</b> ${esc(summary.conclusion)}</div>
      <table>
        <thead>
          <tr>
            <th>Group</th><th>Count</th><th>Avg Pre</th><th>Avg Post</th><th>Avg Delta</th><th>Improved %</th><th>Motivation Delta</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>control</td>
            <td>${esc(groups.control?.count)}</td>
            <td>${esc(groups.control?.avg_pre_score)}</td>
            <td>${esc(groups.control?.avg_post_score)}</td>
            <td>${esc(groups.control?.avg_score_delta)}</td>
            <td>${esc(groups.control?.improved_ratio)}</td>
            <td>${esc(groups.control?.avg_motivation_delta)}</td>
          </tr>
          <tr>
            <td>experimental</td>
            <td>${esc(groups.experimental?.count)}</td>
            <td>${esc(groups.experimental?.avg_pre_score)}</td>
            <td>${esc(groups.experimental?.avg_post_score)}</td>
            <td>${esc(groups.experimental?.avg_score_delta)}</td>
            <td>${esc(groups.experimental?.improved_ratio)}</td>
            <td>${esc(groups.experimental?.avg_motivation_delta)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Participants</h2>
      <table>
        <thead>
          <tr>
            <th>Student</th><th>Group</th><th>Pre Score</th><th>Post Score</th><th>Delta</th><th>Pre Motivation</th><th>Post Motivation</th><th>Motivation Delta</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  </body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) {
      setExperimentMessage("PDF терезесін ашу бұғатталды. Pop-up рұқсатын беріңіз.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const selectedParticipant = useMemo(() => {
    if (!editParticipantId || !experimentReport?.participants) return null;
    return experimentReport.participants.find((p: any) => p.participant_id === Number(editParticipantId)) || null;
  }, [editParticipantId, experimentReport]);

  const studentStatsRows = useMemo(() => {
    const raw = Array.isArray(teacherInsights?.students) ? [...teacherInsights.students] : [];
    raw.sort((a: any, b: any) => {
      const scoreDiff = Number(b?.average_score || 0) - Number(a?.average_score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const attemptsDiff = Number(b?.attempts || 0) - Number(a?.attempts || 0);
      if (attemptsDiff !== 0) return attemptsDiff;
      return String(a?.username || "").localeCompare(String(b?.username || ""));
    });
    if (!showOnlyActiveStudents) return raw;
    return raw.filter((s: any) => Number(s?.attempts || 0) > 0);
  }, [teacherInsights, showOnlyActiveStudents]);

  const crosswordMistakeRows = useMemo(() => {
    if (!(mistakes && mistakes.type === "crossword" && Array.isArray(mistakes.rows))) return [];
    const rows = mistakes.rows.map((row: any) => {
      const wrongRaw = Array.isArray(row?.wrong) ? row.wrong : [];
      const wrong = showBlankCrosswordMistakes
        ? wrongRaw
        : wrongRaw.filter((w: any) => String(w?.answer ?? "").trim() !== "(blank)");
      const top = wrong[0] || (showBlankCrosswordMistakes ? null : wrongRaw[0]) || null;
      return {
        ...row,
        wrong,
        top,
      };
    });
    rows.sort((a: any, b: any) => Number(b?.top?.count || 0) - Number(a?.top?.count || 0));
    return rows;
  }, [mistakes, showBlankCrosswordMistakes]);

  const startParticipantEdit = (participant: any) => {
    setEditParticipantId(participant.participant_id);
    setEditPreScore(participant.pre_score != null ? String(participant.pre_score) : "");
    setEditPostScore(participant.post_score != null ? String(participant.post_score) : "");
    setEditPreMotivation(participant.pre_motivation != null ? String(participant.pre_motivation) : "");
    setEditPostMotivation(participant.post_motivation != null ? String(participant.post_motivation) : "");
  };

  const handleSaveParticipantScores = async () => {
    if (!editParticipantId) {
      setExperimentMessage("Қатысушыны таңдаңыз.");
      return;
    }
    try {
      setExperimentBusy(true);
      setExperimentMessage(null);
      const toNumberOrNull = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const num = Number(trimmed);
        return Number.isFinite(num) ? num : null;
      };
      await updateExperimentParticipant(Number(editParticipantId), {
        pre_score: toNumberOrNull(editPreScore),
        post_score: toNumberOrNull(editPostScore),
        pre_motivation: toNumberOrNull(editPreMotivation),
        post_motivation: toNumberOrNull(editPostMotivation),
      });
      if (experimentId) {
        await loadExperimentReportById(Number(experimentId));
      }
      setExperimentMessage("Қатысушы нәтижелері сақталды ✅");
    } catch (e: any) {
      console.error(e);
      setExperimentMessage(e?.response?.data?.detail || "Қатысушыны жаңартуда қате болды.");
    } finally {
      setExperimentBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="hub-hero kz-ornament-card">
        <div className="hub-hero__wrap">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">ANALYTICS HUB</div>
            <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
              📊 Статистика және эксперимент
            </h1>
            <p className="mt-2 text-sm md:text-base text-slate-600">
              Топ/жеке талдау, pre/post салыстыру және dissertation-ready есептер.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="/teacher/lessons"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold border border-slate-900"
              >
                Сабақтарға оралу
              </a>
              <a
                href="/game/quiz"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl border-2 border-slate-300 bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50"
              >
                Quiz кітапхана
              </a>
            </div>
          </div>

          <div className="hub-hero__stats sm:grid sm:grid-cols-2 lg:grid-cols-1">
            <div className="hub-stat">
              <div className="hub-stat__num">{teacherInsights?.summary?.students_count ?? 0}</div>
              <div className="hub-stat__label">Оқушылар</div>
            </div>
            <div className="hub-stat">
              <div className="hub-stat__num">{teacherInsights?.summary?.attempts_count ?? 0}</div>
              <div className="hub-stat__label">Әрекет саны</div>
            </div>
            <div className="hub-stat">
              <div className="hub-stat__num">
                {Math.round(teacherInsights?.summary?.group_average_score ?? 0)}%
              </div>
              <div className="hub-stat__label">Орташа нәтиже</div>
            </div>
            <div className="hub-stat">
              <div className="hub-stat__num">{experiments.length}</div>
              <div className="hub-stat__label">Эксперимент саны</div>
            </div>
          </div>
        </div>
      </section>

      <div className="hub-grid">
        <div className="hub-side space-y-3">
        <div className="text-sm font-medium text-slate-700">Іздеу параметрлері</div>
        <div className="grid gap-2">
          <select
            value={lessonId}
            onChange={(e) => setLessonId(Number(e.target.value))}
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
            value={assignmentId}
            onChange={(e) => handlePickAssignment(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Тапсырма таңдаңыз
            </option>
            {lessonAssignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
          <button
            onClick={exportCsv}
            className="px-4 py-2 rounded-lg border text-sm"
            type="button"
          >
            CSV экспорт
          </button>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="Басталу күні"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="Аяқталу күні"
          />
        </div>
        <div className="grid gap-2">
          <input
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            placeholder="Шаблон ID"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={templateIds}
            onChange={(e) => setTemplateIds(e.target.value)}
            placeholder="Шаблон ID тізімі (1,2,3)"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={slideId}
            onChange={(e) => setSlideId(e.target.value)}
            placeholder="Слайд ID"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={load}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm"
            disabled={loading}
          >
            {loading ? "Жүктелуде..." : "Нәтижені көру"}
          </button>
        </div>
        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
            {error}
          </div>
        )}
        </div>

        <div className="hub-main">
          <div className="hub-section space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-medium text-slate-700">Диссертациялық эксперимент (Pre/Post)</div>
            <div className="text-xs text-slate-500">
              Бағыт: <b>База данных</b> · Control vs Experimental
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleCreateSampleExperiment}
              type="button"
              className="px-3 py-2 rounded-lg border text-sm"
              disabled={experimentBusy}
            >
              DB Sample құру
            </button>
            <button
              onClick={handleAutoSplit}
              type="button"
              className="px-3 py-2 rounded-lg border text-sm"
              disabled={experimentBusy || !experimentId}
            >
              Auto split 50/50
            </button>
            <button
              onClick={handleExperimentCsvExport}
              type="button"
              className="px-3 py-2 rounded-lg border text-sm"
              disabled={!experimentId}
            >
              CSV есеп
            </button>
            <button
              onClick={handleExperimentPdfExport}
              type="button"
              className="px-3 py-2 rounded-lg border text-sm"
              disabled={!experimentReport?.summary}
            >
              PDF есеп
            </button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <select
            value={experimentId}
            onChange={(e) => setExperimentId(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Эксперимент таңдаңыз
            </option>
            {experiments.map((exp) => (
              <option key={exp.id} value={exp.id}>
                {exp.title}
              </option>
            ))}
          </select>
          <select
            value={experimentLessonId}
            onChange={(e) => {
              const value = Number(e.target.value);
              setExperimentLessonId(value);
              void loadExperimentEnrollments(value);
            }}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Сабақ таңдаңыз
            </option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (experimentId) void loadExperimentReportById(Number(experimentId));
            }}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50"
            disabled={!experimentId || experimentBusy}
          >
            Есепті жаңарту
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <input
            value={expTitle}
            onChange={(e) => setExpTitle(e.target.value)}
            placeholder="Эксперимент атауы"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={expFocusTopic}
            onChange={(e) => setExpFocusTopic(e.target.value)}
            placeholder="Бағыт (мыс: База данных)"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={expHypothesis}
            onChange={(e) => setExpHypothesis(e.target.value)}
            placeholder="Гипотеза"
            className="border rounded-lg px-3 py-2 text-sm min-h-[84px] md:col-span-2"
          />
          <input type="date" value={expPreStart} onChange={(e) => setExpPreStart(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={expPreEnd} onChange={(e) => setExpPreEnd(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={expPostStart} onChange={(e) => setExpPostStart(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={expPostEnd} onChange={(e) => setExpPostEnd(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <button
          type="button"
          onClick={handleCreateExperiment}
          className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm disabled:opacity-50"
          disabled={experimentBusy}
        >
          Эксперимент құру
        </button>

        {experimentEnrollments.length > 0 && (
          <div className="rounded-xl border border-slate-100 p-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={assignGroup}
                onChange={(e) => setAssignGroup(e.target.value as "control" | "experimental")}
                className="border rounded-lg px-2 py-1 text-sm"
              >
                <option value="control">Control group</option>
                <option value="experimental">Experimental group</option>
              </select>
              <button
                type="button"
                onClick={handleAssignStudents}
                className="px-3 py-1.5 rounded-lg border text-sm"
                disabled={!experimentId || experimentBusy}
              >
                Таңдалғандарды топқа қосу
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {experimentEnrollments.map((row) => (
                <label key={row.id} className="flex items-center gap-2 text-sm border rounded px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={selectedStudents.includes(row.student)}
                    onChange={() => toggleStudentSelection(row.student)}
                  />
                  <span>{row.student_username || `Student #${row.student}`}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {experimentReport?.summary && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-100 p-3">
                <div className="text-xs text-slate-500">Қатысушылар</div>
                <div className="text-lg font-semibold">{experimentReport.summary.participants_total ?? 0}</div>
              </div>
              <div className="rounded-xl border border-slate-100 p-3">
                <div className="text-xs text-slate-500">Difference-in-differences</div>
                <div className="text-lg font-semibold">
                  {experimentReport.summary.difference_in_differences != null
                    ? `${experimentReport.summary.difference_in_differences}%`
                    : "-"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 p-3">
                <div className="text-xs text-slate-500">Focus</div>
                <div className="text-lg font-semibold">{experimentReport.summary.focus_topic || "База данных"}</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-100 p-3">
                <div className="text-xs text-slate-500">P-value (approx)</div>
                <div className="text-base font-semibold">
                  {experimentReport.summary.p_value_approx != null ? experimentReport.summary.p_value_approx : "-"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 p-3">
                <div className="text-xs text-slate-500">Effect size (d)</div>
                <div className="text-base font-semibold">
                  {experimentReport.summary.effect_size_cohens_d != null
                    ? experimentReport.summary.effect_size_cohens_d
                    : "-"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 p-3">
                <div className="text-xs text-slate-500">95% CI</div>
                <div className="text-base font-semibold">
                  {experimentReport.summary.ci95_low != null && experimentReport.summary.ci95_high != null
                    ? `[${experimentReport.summary.ci95_low}; ${experimentReport.summary.ci95_high}]`
                    : "-"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 p-3">
                <div className="text-xs text-slate-500">Маңыздылық</div>
                <div className="text-base font-semibold">
                  {experimentReport.summary.is_statistically_significant === true
                    ? "Иә (p<0.05)"
                    : experimentReport.summary.is_statistically_significant === false
                    ? "Жоқ"
                    : "-"}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {(["control", "experimental"] as const).map((groupKey) => {
                const row = experimentReport.groups?.[groupKey];
                return (
                  <div key={groupKey} className="rounded-xl border border-slate-100 p-3">
                    <div className="text-sm font-medium mb-2 capitalize">{groupKey} group</div>
                    <div className="text-xs text-slate-500">
                      Pre: {row?.avg_pre_score ?? "-"} · Post: {row?.avg_post_score ?? "-"} · Δ: {row?.avg_score_delta ?? "-"}
                    </div>
                    <div className="text-xs text-slate-500">
                      Motivation Δ: {row?.avg_motivation_delta ?? "-"} · Improved: {row?.improved_ratio ?? "-"}%
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-sm text-emerald-900">
              {experimentReport.summary.conclusion}
            </div>

            {Array.isArray(experimentReport.participants) && experimentReport.participants.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700">Қатысушылар нәтижесі</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {experimentReport.participants.map((participant: any) => (
                    <button
                      key={participant.participant_id}
                      type="button"
                      onClick={() => startParticipantEdit(participant)}
                      className="w-full h-full text-left rounded-lg border border-slate-100 px-3 py-2 text-xs hover:bg-slate-50"
                    >
                      {participant.student_username} · {participant.group} · pre {participant.pre_score ?? "-"} · post {participant.post_score ?? "-"} · Δ {participant.improvement ?? "-"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedParticipant && (
              <div className="rounded-xl border border-slate-100 p-3 space-y-2">
                <div className="text-sm font-medium">Қатысушыны түзету: {selectedParticipant.student_username}</div>
                <div className="grid gap-2 md:grid-cols-4">
                  <input value={editPreScore} onChange={(e) => setEditPreScore(e.target.value)} placeholder="Pre score (0-100)" className="border rounded px-2 py-1 text-sm" />
                  <input value={editPostScore} onChange={(e) => setEditPostScore(e.target.value)} placeholder="Post score (0-100)" className="border rounded px-2 py-1 text-sm" />
                  <input value={editPreMotivation} onChange={(e) => setEditPreMotivation(e.target.value)} placeholder="Pre motivation (0-10)" className="border rounded px-2 py-1 text-sm" />
                  <input value={editPostMotivation} onChange={(e) => setEditPostMotivation(e.target.value)} placeholder="Post motivation (0-10)" className="border rounded px-2 py-1 text-sm" />
                </div>
                <button
                  type="button"
                  onClick={handleSaveParticipantScores}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm"
                  disabled={experimentBusy}
                >
                  Өзгерісті сақтау
                </button>
              </div>
            )}
          </div>
        )}

        {experimentMessage && (
          <div className="text-xs text-slate-700 border border-slate-100 bg-slate-50 rounded-lg p-2">
            {experimentMessage}
          </div>
        )}
          </div>
        </div>
      </div>

      {teacherInsights?.summary && (
        <div className="hub-section space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="text-xs text-slate-500">Оқушылар саны</div>
              <div className="text-xl font-semibold">{teacherInsights.summary.students_count ?? 0}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="text-xs text-slate-500">Әрекет саны</div>
              <div className="text-xl font-semibold">{teacherInsights.summary.attempts_count ?? 0}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="text-xs text-slate-500">Бағаланған әрекет</div>
              <div className="text-xl font-semibold">{teacherInsights.summary.scored_attempts ?? 0}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="text-xs text-slate-500">Орташа нәтиже</div>
              <div className="text-xl font-semibold">{Math.round(teacherInsights.summary.group_average_score ?? 0)}%</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="text-xs text-slate-500">Жалпы уақыт</div>
              <div className="text-xl font-semibold">
                {((teacherInsights.summary.total_time_seconds || 0) / 3600).toFixed(1)} сағ
              </div>
            </div>
          </div>

          {Array.isArray(teacherInsights.progress_by_day) && teacherInsights.progress_by_day.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="text-sm font-medium text-slate-700 mb-3">Прогресс графигі (күндер)</div>
              <div className="space-y-2">
                {teacherInsights.progress_by_day.map((row: any) => (
                  <div key={row.date} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{row.date}</span>
                      <span>{Math.round(row.average_score ?? 0)}%</span>
                    </div>
                    <div className="h-2 rounded bg-slate-100">
                      <div
                        className="h-2 rounded bg-emerald-500"
                        style={{ width: `${Math.max(0, Math.min(100, row.average_score || 0))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(teacherInsights.students) && teacherInsights.students.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="text-sm font-medium text-slate-700">Топ және жеке статистика</div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-slate-500">
                    Көрсетілді: {studentStatsRows.length} / {teacherInsights.students.length}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOnlyActiveStudents((prev) => !prev)}
                    className="h-8 px-3 rounded-full border bg-white text-xs"
                  >
                    {showOnlyActiveStudents ? "Барлығын көрсету" : "Тек белсенді"}
                  </button>
                </div>
              </div>

              {studentStatsRows.length === 0 ? (
                <div className="text-sm text-slate-500">Белсенді оқушы табылмады.</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {studentStatsRows.map((student: any, idx: number) => {
                    const score = toPercent(student.average_score);
                    return (
                      <div key={student.student_id} className="rounded-xl border border-slate-100 p-3 bg-slate-50/40">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600">
                              #{idx + 1}
                            </span>
                            <span className="text-sm font-medium text-slate-800">{student.username}</span>
                          </div>
                          <span className="font-mono text-sm font-semibold text-slate-900">{score}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-200">
                          <div
                            className="h-2 rounded-full bg-emerald-500"
                            style={{ width: `${Math.max(2, score)}%` }}
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
                            Деңгей: {student.learning_level || "-"}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
                            Әрекет: {student.attempts ?? 0}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
                            Уақыты: {formatHours(student.total_time_seconds)} сағ
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="text-sm font-medium text-slate-700">Нәтиже</div>
          <div className="text-xs text-slate-500">
            Түрі: {result.type} | Барлығы: {result.total}
          </div>

          {result.type === "quiz" && (
              <div className="text-sm">
                Дұрыс жауап: {result.correct} · {Math.round(result.correct_percentage ?? 0)}%
                <div className="h-2 mt-2 rounded bg-slate-100">
                  <div
                    className="h-2 rounded bg-emerald-500"
                    style={{ width: `${Math.round(result.correct_percentage ?? 0)}%` }}
                  />
                </div>
              </div>
          )}

          {result.type === "poll" && Array.isArray(result.results) && (
            <div className="space-y-2">
              {result.results.map((r: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span>{r.option}</span>
                  <span className="font-mono">{Math.round(r.percentage)}%</span>
                  <div className="ml-3 h-2 flex-1 rounded bg-slate-100">
                    <div
                      className="h-2 rounded bg-sky-500"
                      style={{ width: `${Math.round(r.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {["matching", "sorting", "grouping"].includes(result.type) &&
            Array.isArray(result.results) && (
              <div className="space-y-2">
                <div className="text-sm">
                  Дұрыс жауап: {result.correct} · {Math.round(result.correct_percentage ?? 0)}%
                </div>
                {result.results.map((r: any, idx: number) => (
                  <div key={idx} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">
                        {String(r.value).slice(0, 120)}
                        {String(r.value).length > 120 ? "…" : ""}
                      </span>
                      <span className="font-mono">
                        {r.count} · {Math.round(r.percentage)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {mistakes &&
        mistakes.type === "quiz" &&
        mistakes.mode === "multi" &&
        Array.isArray(mistakes.rows) && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium text-slate-700">Quiz қателері (көп сұрақ)</div>
            <div className="text-xs text-slate-500">
              Сұрақ саны: {mistakes.rows.length} · Барлық жауап: {mistakes.total ?? 0}
            </div>
          </div>

          {mistakes.rows.map((row: any, idx: number) => (
            <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 space-y-2">
              <div className="text-sm font-medium text-slate-800">
                {row.index}. {row.question}
              </div>
              <div className="text-xs text-slate-500">
                Дұрыс жауап: {row.correct_answer} · Жауап бергендер: {row.total ?? 0}
              </div>
              {Array.isArray(row.wrong) && row.wrong.length > 0 ? (
                <div className="space-y-1">
                  {row.wrong.map((w: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{normalizeMistakeLabel(w.answer)}</span>
                      <span className="font-mono">
                        {w.count} · {Math.round(w.percentage)}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">Қате жауап жоқ.</div>
              )}
            </div>
          ))}
        </div>
      )}

      {mistakes &&
        mistakes.type === "quiz" &&
        mistakes.mode !== "multi" &&
        mistakes.wrong && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="text-sm font-medium text-slate-700">Қате жауаптар</div>
          <div className="text-xs text-slate-500">
            Сұрақ: {mistakes.question} · Дұрыс жауап: {mistakes.correct_answer}
          </div>
          {mistakes.wrong.length === 0 ? (
            <div className="text-sm text-slate-500">Қате жауаптар жоқ.</div>
          ) : (
            <div className="space-y-2">
              {mistakes.wrong.map((r: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span>{r.answer}</span>
                  <span className="font-mono">
                    {r.count} · {Math.round(r.percentage)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mistakes && mistakes.type === "poll" && Array.isArray(mistakes.results) && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="text-sm font-medium text-slate-700">Poll нәтижелері</div>
          {mistakes.results.map((r: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span>{r.option}</span>
              <span className="font-mono">{Math.round(r.percentage)}%</span>
            </div>
          ))}
        </div>
      )}

      {mistakes && mistakes.type === "matching" && Array.isArray(mistakes.rows) && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="text-sm font-medium text-slate-700">Matching қателері</div>
          {mistakes.rows.map((row: any, idx: number) => (
            <div key={idx} className="text-sm">
              <div className="font-medium">{row.left} → {row.correct}</div>
              {(row.wrong || []).length === 0 ? (
                <div className="text-xs text-slate-500">Қате жауап жоқ.</div>
              ) : (
                row.wrong.map((w: any, i: number) => (
                  <div key={i} className="text-xs text-slate-600">
                    {w.answer} — {w.count} ({Math.round(w.percentage)}%)
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}

      {mistakes && mistakes.type === "sorting" && Array.isArray(mistakes.rows) && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="text-sm font-medium text-slate-700">Sorting қателері</div>
          {mistakes.rows.map((row: any, idx: number) => (
            <div key={idx} className="text-sm">
              <div className="font-medium">
                {row.index + 1}-орын дұрыс: {row.correct}
              </div>
              {(row.wrong || []).length === 0 ? (
                <div className="text-xs text-slate-500">Қате жауап жоқ.</div>
              ) : (
                row.wrong.map((w: any, i: number) => (
                  <div key={i} className="text-xs text-slate-600">
                    {w.answer} — {w.count} ({Math.round(w.percentage)}%)
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}

      {mistakes && mistakes.type === "grouping" && Array.isArray(mistakes.rows) && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="text-sm font-medium text-slate-700">Grouping қателері</div>
          {mistakes.rows.map((row: any, idx: number) => (
            <div key={idx} className="text-sm">
              <div className="font-medium">
                {row.item} → дұрыс топ: {row.expected}
              </div>
              {(row.wrong || []).length === 0 ? (
                <div className="text-xs text-slate-500">Қате жауап жоқ.</div>
              ) : (
                row.wrong.map((w: any, i: number) => (
                  <div key={i} className="text-xs text-slate-600">
                    {w.answer} — {w.count} ({Math.round(w.percentage)}%)
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}

      {mistakes && mistakes.type === "flashcards" && Array.isArray(mistakes.rows) && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="text-sm font-medium text-slate-700">Flashcards қателері</div>
          {mistakes.rows.map((row: any, idx: number) => (
            <div key={idx} className="text-sm">
              <div className="font-medium">
                Карта {row.index + 1}: {row.front} — {row.back}
              </div>
              {(row.wrong || []).length === 0 ? (
                <div className="text-xs text-slate-500">Қате жауап жоқ.</div>
              ) : (
                row.wrong.map((w: any, i: number) => (
                  <div key={i} className="text-xs text-slate-600">
                    {w.answer} — {w.count} ({Math.round(w.percentage)}%)
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}

      {mistakes && mistakes.type === "crossword" && Array.isArray(mistakes.rows) && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium text-slate-700">Crossword қателері</div>
            <button
              type="button"
              onClick={() => setShowBlankCrosswordMistakes((prev) => !prev)}
              className="h-8 px-3 rounded-full border bg-white text-xs"
            >
              {showBlankCrosswordMistakes ? "Бос ұяшықты жасыру" : "Бос ұяшықты көрсету"}
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
              <div className="text-[11px] text-slate-500">Ұяшық саны</div>
              <div className="text-lg font-semibold">{crosswordMistakeRows.length}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
              <div className="text-[11px] text-slate-500">Қате тіркелген ұяшық</div>
              <div className="text-lg font-semibold">
                {crosswordMistakeRows.filter((r: any) => (r.wrong || []).length > 0).length}
              </div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
              <div className="text-[11px] text-slate-500">Ең жиі қате</div>
              <div className="text-sm font-semibold">
                {crosswordMistakeRows[0]?.top
                  ? `${normalizeMistakeLabel(crosswordMistakeRows[0].top.answer)} (${Math.round(crosswordMistakeRows[0].top.percentage || 0)}%)`
                  : "-"}
              </div>
            </div>
          </div>

          {crosswordMistakeRows.length === 0 ? (
            <div className="text-sm text-slate-500">Crossword бойынша қате дерегі жоқ.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Ұяшық</th>
                    <th className="text-left px-3 py-2 font-medium">Дұрыс әріп</th>
                    <th className="text-left px-3 py-2 font-medium">Ең жиі қате жауап</th>
                    <th className="text-left px-3 py-2 font-medium">Жиілік</th>
                  </tr>
                </thead>
                <tbody>
                  {crosswordMistakeRows.map((row: any, idx: number) => (
                    <tr key={`${row.cell?.r}-${row.cell?.c}-${idx}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs">({row.cell?.r}, {row.cell?.c})</td>
                      <td className="px-3 py-2 font-semibold">{row.expected}</td>
                      <td className="px-3 py-2">{row.top ? normalizeMistakeLabel(row.top.answer) : "Қате жоқ"}</td>
                      <td className="px-3 py-2">
                        {row.top ? `${row.top.count} (${Math.round(row.top.percentage || 0)}%)` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {grouped.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {grouped.map((g, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-2">
              <div className="text-xs text-slate-500">
                Шаблон: {g.template} · Түрі: {g.type} · Барлығы: {g.total}
              </div>
              {g.type === "quiz" && (
                <div className="text-sm">
                  Дұрыс жауап: {g.correct} · {Math.round(g.correct_percentage ?? 0)}%
                </div>
              )}
              {g.type === "poll" && Array.isArray(g.results) && (
                <div className="space-y-1">
                  {g.results.map((r: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span>{r.option}</span>
                      <span className="font-mono">{Math.round(r.percentage)}%</span>
                    </div>
                  ))}
                </div>
              )}
              {["matching", "sorting", "grouping"].includes(g.type) &&
                Array.isArray(g.results) && (
                  <div className="space-y-1">
                    <div className="text-sm">
                      Дұрыс жауап: {g.correct} · {Math.round(g.correct_percentage ?? 0)}%
                    </div>
                    {g.results.map((r: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="font-mono text-xs">
                          {String(r.value).slice(0, 80)}
                          {String(r.value).length > 80 ? "…" : ""}
                        </span>
                        <span className="font-mono">
                          {r.count} · {Math.round(r.percentage)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          ))}
        </div>
      )}

      {leaderboard.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="text-sm font-medium text-slate-700">Leaderboard</div>
          <div className="space-y-2">
            {leaderboard.map((r, idx) => (
              <div key={r.student_id} className="flex items-center justify-between text-sm">
                <span>
                  {idx + 1}. {r.student__username || "student"}
                </span>
                <span className="font-mono">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
