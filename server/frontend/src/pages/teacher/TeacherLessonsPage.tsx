import { useEffect, useState } from "react";
import api from "../../api/axios";
import { createStudent } from "../../api/auth";
import { applyTemplate } from "../../api/templates";

type Lesson = {
  id: number;
  title: string;
  description?: string;
  subject?: string;
  grade?: string;
  topic?: string;
  objectives?: string;
  materials?: string;
  homework?: string;
  assessment?: string;
  resources?: string;
  duration_minutes?: number | null;
  is_shared: boolean;
  share_code?: string | null;
  created_at?: string;
};
type Assignment = {
  id: number;
  lesson: number;
  lesson_title?: string;
  title: string;
  description?: string;
  assignment_type?: string;
  effective_assignment_type?: string;
  content_id?: number | null;
  due_at?: string | null;
  is_published?: boolean;
  created_at?: string;
};
type Submission = {
  id: number;
  assignment: number;
  assignment_title?: string;
  student: number;
  student_username?: string;
  text?: string;
  file?: string | null;
  score?: number | null;
  feedback?: string;
  submitted_at?: string;
};
type Reward = {
  id: number;
  student: number;
  title: string;
  description?: string;
  level?: string;
  icon?: string;
};
type Template = {
  id: number;
  title: string;
  template_type?: string;
};
type Enrollment = {
  id: number;
  student: number;
  student_username?: string;
  lesson: number;
};

function fmtDate(s?: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  return d.toLocaleString();
}

export default function TeacherLessonsPage() {
  const [items, setItems] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [topic, setTopic] = useState("");
  const [objectives, setObjectives] = useState("");
  const [materials, setMaterials] = useState("");
  const [homework, setHomework] = useState("");
  const [assessment, setAssessment] = useState("");
  const [resources, setResources] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [asgLesson, setAsgLesson] = useState<number | "">("");
  const [asgTitle, setAsgTitle] = useState("");
  const [asgType, setAsgType] = useState("quiz");
  const [asgContentId, setAsgContentId] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [assignFor, setAssignFor] = useState<Assignment | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [showSubsFor, setShowSubsFor] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [savingSubId, setSavingSubId] = useState<number | null>(null);
  const [rewardTitle, setRewardTitle] = useState("");
  const [rewardDesc, setRewardDesc] = useState("");
  const [rewardLevel, setRewardLevel] = useState("silver");
  const [rewardIcon, setRewardIcon] = useState("🏆");
  const [selectedRewardStudent, setSelectedRewardStudent] = useState<number | "">("");
  const [rewardLessonId, setRewardLessonId] = useState<number | "">("");
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [editingRewardId, setEditingRewardId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editLevel, setEditLevel] = useState("silver");
  const [editIcon, setEditIcon] = useState("🏆");
  const [asgDueDate, setAsgDueDate] = useState("");
  const [asgDueTime, setAsgDueTime] = useState("");
  const [asgPublished, setAsgPublished] = useState(true);
  const [creatingAsg, setCreatingAsg] = useState(false);
  const [asgError, setAsgError] = useState<string | null>(null);
  const [addStudentInputs, setAddStudentInputs] = useState<Record<number, string>>({});
  const [addStudentError, setAddStudentError] = useState<string | null>(null);
  const [applyTplFor, setApplyTplFor] = useState<Record<number, string>>({});
  const [applyTplMsg, setApplyTplMsg] = useState<string | null>(null);
  const [builderMode, setBuilderMode] = useState<"full" | "quick">("quick");
  const [builderLessonTitle, setBuilderLessonTitle] = useState("");
  const [builderLessonDesc, setBuilderLessonDesc] = useState("");
  const [builderLessonSubject, setBuilderLessonSubject] = useState("");
  const [builderLessonGrade, setBuilderLessonGrade] = useState("");
  const [builderLessonTopic, setBuilderLessonTopic] = useState("");
  const [builderLessonObjectives, setBuilderLessonObjectives] = useState("");
  const [builderLessonMaterials, setBuilderLessonMaterials] = useState("");
  const [builderLessonHomework, setBuilderLessonHomework] = useState("");
  const [builderLessonAssessment, setBuilderLessonAssessment] = useState("");
  const [builderLessonResources, setBuilderLessonResources] = useState("");
  const [builderLessonDuration, setBuilderLessonDuration] = useState("");
  const [builderTemplateId, setBuilderTemplateId] = useState("");
  const [builderAsgTitle, setBuilderAsgTitle] = useState("");
  const [builderDueDate, setBuilderDueDate] = useState("");
  const [builderDueTime, setBuilderDueTime] = useState("");
  const [builderPublish, setBuilderPublish] = useState(true);
  const [builderMsg, setBuilderMsg] = useState<string | null>(null);
  const [builderBusy, setBuilderBusy] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentUsername, setNewStudentUsername] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [createStudentMsg, setCreateStudentMsg] = useState<string | null>(null);
  const [hubSearch, setHubSearch] = useState("");
  const [showAllLessons, setShowAllLessons] = useState(false);

  const load = async () => {
    try {
      setError(null);
      setLoading(true);
      const res = await api.get("/lessons/lessons/");
      setItems(res.data ?? []);
      if (!asgLesson && (res.data ?? []).length) {
        setAsgLesson((res.data ?? [])[0].id);
      }
      const asg = await api.get("/lessons/assignments/");
      setAssignments(asg.data ?? []);
      const tpl = await api.get("/slide/templates/");
      setTemplates(tpl.data ?? []);
      const r = await api.get("/lessons/rewards/");
      setRewards(r.data ?? []);
    } catch (e) {
      console.error(e);
      setError("Сабақтар жүктелмеді.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (rewardLessonId) {
      void loadEnrollments(Number(rewardLessonId));
    }
  }, [rewardLessonId]);

  const createLesson = async () => {
    if (!title.trim()) return;
    try {
      await api.post("/lessons/lessons/", {
        title: title.trim(),
        description: description.trim(),
        subject: subject.trim(),
        grade: grade.trim(),
        topic: topic.trim(),
        objectives: objectives.trim(),
        materials: materials.trim(),
        homework: homework.trim(),
        assessment: assessment.trim(),
        resources: resources.trim(),
        duration_minutes: durationMinutes ? Number(durationMinutes) : null,
      });
      setTitle("");
      setDescription("");
      setSubject("");
      setGrade("");
      setTopic("");
      setObjectives("");
      setMaterials("");
      setHomework("");
      setAssessment("");
      setResources("");
      setDurationMinutes("");
      await load();
    } catch (e) {
      console.error(e);
      setError("Сабақ жасау кезінде қате болды.");
    }
  };

  const shareLesson = async (id: number) => {
    try {
      await api.post(`/lessons/lessons/${id}/share/`);
      await load();
    } catch (e) {
      console.error(e);
      setError("Бөлісу коды жасалмады.");
    }
  };

  const enrollStudent = async (lessonId: number) => {
    const value = (addStudentInputs[lessonId] || "").trim();
    if (!value) {
      setAddStudentError("Student username/email жазыңыз.");
      return;
    }
    setAddStudentError(null);
    try {
      const isEmail = value.includes("@");
      await api.post(`/lessons/lessons/${lessonId}/enroll/`, isEmail ? { email: value } : { username: value });
      setAddStudentInputs((prev) => ({ ...prev, [lessonId]: "" }));
      await loadEnrollments(lessonId);
    } catch (e) {
      console.error(e);
      setAddStudentError("Студентті қосу кезінде қате болды.");
    }
  };

  const handleApplyTemplate = async (lessonId: number) => {
    const tplId = Number(applyTplFor[lessonId]);
    if (!tplId) {
      setApplyTplMsg("Шаблон таңдаңыз.");
      return;
    }
    setApplyTplMsg(null);
    try {
      await applyTemplate(tplId, { lesson_id: lessonId });
      setApplyTplMsg("Шаблон сабаққа қосылды ✅");
    } catch (e) {
      console.error(e);
      setApplyTplMsg("Шаблонды қосу кезінде қате болды.");
    }
  };

  const handleQuickBuild = async () => {
    setBuilderMsg(null);
    if (!builderTemplateId || !builderAsgTitle.trim()) {
      setBuilderMsg("Шаблон және тапсырма атауы қажет.");
      return;
    }
    if (builderMode === "full" && !builderLessonTitle.trim()) {
      setBuilderMsg("Сабақ атауын толтырыңыз.");
      return;
    }
    const dueAt =
      builderDueDate && builderDueTime ? `${builderDueDate}T${builderDueTime}` : null;
    const tplId = Number(builderTemplateId);
    const tpl = templates.find((t) => t.id === tplId);
    const asgType = tpl?.template_type || "quiz";

    try {
      setBuilderBusy(true);
      let lessonId: number;

      if (builderMode === "full") {
        const l = await api.post("/lessons/lessons/", {
          title: builderLessonTitle.trim(),
          description: builderLessonDesc.trim(),
          subject: builderLessonSubject.trim(),
          grade: builderLessonGrade.trim(),
          topic: builderLessonTopic.trim(),
          objectives: builderLessonObjectives.trim(),
          materials: builderLessonMaterials.trim(),
          homework: builderLessonHomework.trim(),
          assessment: builderLessonAssessment.trim(),
          resources: builderLessonResources.trim(),
          duration_minutes: builderLessonDuration ? Number(builderLessonDuration) : null,
        });
        lessonId = l.data?.id;
      } else {
        const l = await api.post("/lessons/lessons/", {
          title: `Quick: ${builderAsgTitle.trim()}`,
          description: "Auto-created for quick assignment",
        });
        lessonId = l.data?.id;
      }

      if (!lessonId) throw new Error("Lesson create failed");
      await applyTemplate(tplId, { lesson_id: lessonId });

      await api.post("/lessons/assignments/", {
        lesson: lessonId,
        title: builderAsgTitle.trim(),
        description: "",
        assignment_type: asgType,
        content_id: tplId,
        due_at: dueAt,
        is_published: builderPublish,
      });

      setBuilderMsg("Дайын ✅ Сабақ және тапсырма құрылды.");
      setBuilderLessonTitle("");
      setBuilderLessonDesc("");
      setBuilderLessonSubject("");
      setBuilderLessonGrade("");
      setBuilderLessonTopic("");
      setBuilderLessonObjectives("");
      setBuilderLessonMaterials("");
      setBuilderLessonHomework("");
      setBuilderLessonAssessment("");
      setBuilderLessonResources("");
      setBuilderLessonDuration("");
      setBuilderAsgTitle("");
      setBuilderTemplateId("");
      setBuilderDueDate("");
      setBuilderDueTime("");
      setBuilderPublish(true);
      await load();
    } catch (e) {
      console.error(e);
      setBuilderMsg("Құру кезінде қате болды.");
    } finally {
      setBuilderBusy(false);
    }
  };

  const handleCreateStudent = async () => {
    setCreateStudentMsg(null);
    if (!newStudentUsername.trim() || !newStudentPassword.trim()) {
      setCreateStudentMsg("Username және пароль керек.");
      return;
    }
    try {
      await createStudent({
        username: newStudentUsername.trim(),
        email: newStudentEmail.trim() || undefined,
        password: newStudentPassword.trim(),
        full_name: newStudentName.trim() || undefined,
      });
      setCreateStudentMsg("Студент тіркелді ✅ Енді сабаққа қоса аласыз.");
      setNewStudentName("");
      setNewStudentUsername("");
      setNewStudentEmail("");
      setNewStudentPassword("");
    } catch (e) {
      console.error(e);
      setCreateStudentMsg("Студент тіркеуде қате болды.");
    }
  };

  const createAssignment = async () => {
    setAsgError(null);
    if (!asgLesson || !asgTitle.trim()) {
      setAsgError("Сабақ пен тапсырма атауын толтырыңыз.");
      return;
    }
    const dueAt =
      asgDueDate && asgDueTime ? `${asgDueDate}T${asgDueTime}` : null;
    try {
      setCreatingAsg(true);
      await api.post("/lessons/assignments/", {
        lesson: asgLesson,
        title: asgTitle.trim(),
        description: "",
        assignment_type: asgType,
        content_id: asgContentId ? Number(asgContentId) : null,
        due_at: dueAt,
        is_published: asgPublished,
      });
      setAsgTitle("");
      setAsgContentId("");
      setAsgDueDate("");
      setAsgDueTime("");
      setAsgPublished(true);
      await load();
    } catch (e) {
      console.error(e);
      setAsgError("Тапсырма жасау кезінде қате болды.");
    } finally {
      setCreatingAsg(false);
    }
  };

  const loadEnrollments = async (lessonId: number) => {
    try {
      const res = await api.get(`/lessons/enrollments/?lesson=${lessonId}`);
      setEnrollments(res.data ?? []);
    } catch (e) {
      console.error(e);
      setError("Enrollments жүктелмеді.");
    }
  };

  const openAssign = async (a: Assignment) => {
    setAssignFor(a);
    setSelectedStudents([]);
    await loadEnrollments(a.lesson);
  };

  const toggleStudent = (id: number) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const assignStudents = async () => {
    if (!assignFor) return;
    try {
      await api.post(`/lessons/assignments/${assignFor.id}/assign/`, {
        students: selectedStudents,
      });
      setAssignFor(null);
      setSelectedStudents([]);
    } catch (e) {
      console.error(e);
      setError("Тағайындау кезінде қате болды.");
    }
  };

  const openSubmissions = async (a: Assignment) => {
    setShowSubsFor(a);
    try {
      const res = await api.get(`/lessons/submissions/?assignment=${a.id}`);
      setSubmissions(res.data ?? []);
    } catch (e) {
      console.error(e);
      setError("Submissions жүктелмеді.");
    }
  };

  const updateSubmission = async (s: Submission) => {
    try {
      setSavingSubId(s.id);
      await api.patch(`/lessons/submissions/${s.id}/`, {
        score: s.score,
        feedback: s.feedback,
      });
    } catch (e) {
      console.error(e);
      setError("Score/feedback сақталмады.");
    } finally {
      setSavingSubId(null);
    }
  };

  const createReward = async () => {
    if (!selectedRewardStudent || !rewardTitle.trim()) return;
    try {
      await api.post("/lessons/rewards/", {
        student: selectedRewardStudent,
        title: rewardTitle.trim(),
        description: rewardDesc.trim(),
        level: rewardLevel,
        icon: rewardIcon,
      });
      setRewardTitle("");
      setRewardDesc("");
      setRewardIcon("🏆");
      setSelectedRewardStudent("");
      await load();
    } catch (e) {
      console.error(e);
      setError("Reward сақтау кезінде қате болды.");
    }
  };

  const deleteReward = async (id: number) => {
    try {
      await api.delete(`/lessons/rewards/${id}/`);
      await load();
    } catch (e) {
      console.error(e);
      setError("Reward өшірілмеді.");
    }
  };

  const startEditReward = (r: Reward) => {
    setEditingRewardId(r.id);
    setEditTitle(r.title ?? "");
    setEditDesc(r.description ?? "");
    setEditLevel(r.level ?? "silver");
    setEditIcon(r.icon ?? "🏆");
  };

  const saveEditReward = async () => {
    if (!editingRewardId) return;
    try {
      await api.patch(`/lessons/rewards/${editingRewardId}/`, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        level: editLevel,
        icon: editIcon,
      });
      setEditingRewardId(null);
      await load();
    } catch (e) {
      console.error(e);
      setError("Reward сақталмады.");
    }
  };

  const publishedAssignmentsCount = assignments.filter((a) => a.is_published).length;
  const avgLessonDuration = items.length
    ? Math.round(
        items.reduce((acc, item) => acc + Number(item.duration_minutes || 0), 0) / items.length
      )
    : 0;
  const normalizedSearch = hubSearch.trim().toLowerCase();
  const filteredLessons = normalizedSearch
    ? items.filter((l) =>
        [
          l.title,
          l.description,
          l.subject,
          l.grade,
          l.topic,
          l.share_code,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      )
    : items;
  const filteredAssignments = normalizedSearch
    ? assignments.filter((a) =>
        [
          a.title,
          a.description,
          a.lesson_title,
          a.assignment_type,
          a.effective_assignment_type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      )
    : assignments;
  const visibleLessons = showAllLessons ? filteredLessons : filteredLessons.slice(0, 6);
  const todoCards = [
    { label: "1 сабақ құру", done: items.length > 0 },
    { label: "1 тапсырма құру", done: assignments.length > 0 },
    { label: "1 тапсырманы жариялау", done: publishedAssignmentsCount > 0 },
    { label: "1 марапат беру", done: rewards.length > 0 },
  ];
  const doneTodoCount = todoCards.filter((t) => t.done).length;

  return (
    <div className="space-y-5">
      <section className="hub-hero kz-ornament-card">
        <div className="hub-hero__wrap">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-1">
              LESSON HUB
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">📚 Ерекше сабақтар</h1>
            <p className="mt-2 text-sm text-slate-500">
              Сабақ, тапсырма, студент және марапаттарды бір беттен басқару.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a href="/game/quiz" className="px-3 py-1.5 rounded-full border bg-white text-xs">
                Quiz беті
              </a>
              <a href="/game/templates/create" className="px-3 py-1.5 rounded-full border bg-white text-xs">
                Шаблондар
              </a>
              <a href="/teacher/live" className="px-3 py-1.5 rounded-full border bg-white text-xs">
                Тірі сабақ
              </a>
            </div>
          </div>
          <div className="hub-hero__stats sm:grid sm:grid-cols-2 lg:grid-cols-1">
            <div className="hub-stat">
              <div className="hub-stat__num">{items.length}</div>
              <div className="hub-stat__label">Сабақ</div>
            </div>
            <div className="hub-stat">
              <div className="hub-stat__num">{assignments.length}</div>
              <div className="hub-stat__label">
                Тапсырма · Жарияланған: {publishedAssignmentsCount}
              </div>
            </div>
            <div className="hub-stat">
              <div className="hub-stat__num">{avgLessonDuration > 0 ? `${avgLessonDuration}` : "—"}</div>
              <div className="hub-stat__label">Орташа ұзақтық (мин)</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <input
            value={hubSearch}
            onChange={(e) => setHubSearch(e.target.value)}
            placeholder="Іздеу: сабақ, тапсырма, topic, subject..."
            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm md:col-span-2 xl:col-span-1"
          />
          <a
            href="#lesson-create"
            className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm flex items-center justify-center hover:bg-slate-50"
          >
            + Жаңа сабақ
          </a>
          <a
            href="#assignment-create"
            className="h-10 px-4 rounded-xl border border-slate-900 bg-slate-900 text-white text-sm flex items-center justify-center hover:bg-slate-800"
          >
            + Жаңа тапсырма
          </a>
        </div>
      </section>

      <div className="hub-grid">
      <aside className="hub-side space-y-2">
        <div className="text-base font-semibold text-slate-900">Қосымша</div>
        <a
          href="#quick-builder"
          className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        >
          ⚡ Quick Builder
        </a>
        <a
          href="#lesson-create"
          className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        >
          📘 Жаңа сабақ
        </a>
        <a
          href="#assignment-create"
          className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        >
          📝 Жаңа тапсырма
        </a>
        <a
          href="#student-create"
          className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        >
          👥 Оқушы тіркеу
        </a>
        <div className="text-xs text-slate-500 pt-1">
          Қосымша материалдар мен әрекеттерді тез ашу.
        </div>
      </aside>

      <div className="hub-main">
      <section className="hub-section">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-2xl font-semibold text-slate-900">Әрекеттер</div>
          <div className="text-sm text-slate-500">Бір батырмамен қосылады</div>
        </div>
        <div className="hub-cards">
          <a
            href="#quick-builder"
            className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm hover:shadow-md transition"
          >
            <div className="text-sm font-semibold text-slate-900">⚡ Quick Builder</div>
            <div className="mt-2 text-sm text-slate-600">Сабақ/тапсырманы тез жасау</div>
            <div className="mt-2 text-sm text-slate-700">Ашу →</div>
          </a>
          <a
            href="#lesson-create"
            className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm hover:shadow-md transition"
          >
            <div className="text-sm font-semibold text-slate-900">📘 Жаңа сабақ</div>
            <div className="mt-2 text-sm text-slate-600">Толық форма (жабық күйде)</div>
            <div className="mt-2 text-sm text-slate-700">Ашу →</div>
          </a>
          <a
            href="#assignment-create"
            className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm hover:shadow-md transition"
          >
            <div className="text-sm font-semibold text-slate-900">📝 Жаңа тапсырма</div>
            <div className="mt-2 text-sm text-slate-600">Template + дедлайн</div>
            <div className="mt-2 text-sm text-slate-700">Ашу →</div>
          </a>
          <a
            href="#student-create"
            className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm hover:shadow-md transition"
          >
            <div className="text-sm font-semibold text-slate-900">👥 Оқушы тіркеу</div>
            <div className="mt-2 text-sm text-slate-600">Мұғалім арқылы қосу</div>
            <div className="mt-2 text-sm text-slate-700">Ашу →</div>
          </a>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
      <div id="quick-builder" className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            ⚡ Quick Builder
          </summary>
          <div className="mt-3 space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBuilderMode("full")}
                className={[
                  "px-3 py-1.5 rounded-full text-xs border",
                  builderMode === "full" ? "bg-black text-white" : "bg-white",
                ].join(" ")}
              >
                Сабақ + тапсырма
              </button>
              <button
                type="button"
                onClick={() => setBuilderMode("quick")}
                className={[
                  "px-3 py-1.5 rounded-full text-xs border",
                  builderMode === "quick" ? "bg-black text-white" : "bg-white",
                ].join(" ")}
              >
                Тек тапсырма
              </button>
            </div>

            {builderMode === "full" && (
              <div className="space-y-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={builderLessonTitle}
                    onChange={(e) => setBuilderLessonTitle(e.target.value)}
                    placeholder="Сабақ атауы"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    value={builderLessonDesc}
                    onChange={(e) => setBuilderLessonDesc(e.target.value)}
                    placeholder="Қысқаша сипаттама (optional)"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <details className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium text-slate-600">
                    Қосымша мәліметтер (пән, сынып, мақсат, т.б.)
                  </summary>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <input
                      value={builderLessonSubject}
                      onChange={(e) => setBuilderLessonSubject(e.target.value)}
                      placeholder="Пән"
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      value={builderLessonGrade}
                      onChange={(e) => setBuilderLessonGrade(e.target.value)}
                      placeholder="Сынып"
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      value={builderLessonTopic}
                      onChange={(e) => setBuilderLessonTopic(e.target.value)}
                      placeholder="Тақырып"
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      value={builderLessonDuration}
                      onChange={(e) => setBuilderLessonDuration(e.target.value)}
                      placeholder="Ұзақтығы (мин)"
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                    <textarea
                      value={builderLessonObjectives}
                      onChange={(e) => setBuilderLessonObjectives(e.target.value)}
                      placeholder="Мақсаты"
                      className="border rounded-lg px-3 py-2 text-sm md:col-span-2"
                    />
                    <textarea
                      value={builderLessonMaterials}
                      onChange={(e) => setBuilderLessonMaterials(e.target.value)}
                      placeholder="Қажетті құралдар"
                      className="border rounded-lg px-3 py-2 text-sm md:col-span-2"
                    />
                    <textarea
                      value={builderLessonHomework}
                      onChange={(e) => setBuilderLessonHomework(e.target.value)}
                      placeholder="Үй тапсырмасы"
                      className="border rounded-lg px-3 py-2 text-sm md:col-span-2"
                    />
                    <textarea
                      value={builderLessonAssessment}
                      onChange={(e) => setBuilderLessonAssessment(e.target.value)}
                      placeholder="Бағалау критерийі"
                      className="border rounded-lg px-3 py-2 text-sm md:col-span-2"
                    />
                    <textarea
                      value={builderLessonResources}
                      onChange={(e) => setBuilderLessonResources(e.target.value)}
                      placeholder="Қосымша ресурстар/сілтемелер"
                      className="border rounded-lg px-3 py-2 text-sm md:col-span-2"
                    />
                  </div>
                </details>
              </div>
            )}

            <div className="grid gap-2 md:grid-cols-4">
              <select
                value={builderTemplateId}
                onChange={(e) => setBuilderTemplateId(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Template таңдау</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.id} · {t.title}
                  </option>
                ))}
              </select>
              <input
                value={builderAsgTitle}
                onChange={(e) => setBuilderAsgTitle(e.target.value)}
                placeholder="Тапсырма атауы"
                className="border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={builderDueDate}
                onChange={(e) => setBuilderDueDate(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="time"
                value={builderDueTime}
                onChange={(e) => setBuilderDueTime(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={builderPublish}
                onChange={(e) => setBuilderPublish(e.target.checked)}
              />
              Publish
            </label>
            <button
              onClick={handleQuickBuild}
              disabled={builderBusy}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm"
            >
              {builderBusy ? "..." : "Жасау"}
            </button>
            {builderMsg && (
              <div className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2">
                {builderMsg}
              </div>
            )}
          </div>
        </details>
      </div>
      <aside className="kz-ornament-card space-y-3">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-slate-700">To-do list</div>
            <div className="text-xs text-slate-500">
              {doneTodoCount}/{todoCards.length}
            </div>
          </div>
          <div className="space-y-1.5">
            {todoCards.map((t) => (
              <div key={t.label} className="text-xs flex items-center justify-between rounded-lg border border-slate-100 px-2 py-1.5">
                <span className="text-slate-600">{t.label}</span>
                <span className={t.done ? "text-emerald-600" : "text-slate-400"}>{t.done ? "✓" : "•"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-2">
          <div className="text-sm font-semibold text-slate-700">Your activity</div>
          <a href="/game/quiz" className="block w-full rounded-xl border px-3 py-2 text-sm bg-white hover:bg-slate-50">
            📘 Quiz басқару
          </a>
          <a href="/game/templates/create" className="block w-full rounded-xl border px-3 py-2 text-sm bg-white hover:bg-slate-50">
            🧩 Шаблон құру
          </a>
          <a href="/analytics" className="block w-full rounded-xl border px-3 py-2 text-sm bg-white hover:bg-slate-50">
            📊 Аналитика
          </a>
          <a href="/teacher/live" className="block w-full rounded-xl border px-3 py-2 text-sm bg-white hover:bg-slate-50">
            🎥 Тірі сабақ
          </a>
        </div>
      </aside>
      </div>
      </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
      <div id="lesson-create" className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-slate-700">📘 Жаңа сабақ</summary>
          <div className="mt-3 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Сабақ атауы"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Қысқаша сипаттама (optional)"
              className="w-full border rounded-lg px-3 py-2 text-sm min-h-[56px]"
            />
            <details className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-600">
                Қосымша мәліметтер (пән, сынып, мақсат, т.б.)
              </summary>
              <div className="mt-3 space-y-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Пән"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="Сынып"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Тақырып"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="Ұзақтығы (мин)"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <textarea
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  placeholder="Мақсаты"
                  className="w-full border rounded-lg px-3 py-2 text-sm min-h-[56px]"
                />
                <textarea
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  placeholder="Қажетті құралдар"
                  className="w-full border rounded-lg px-3 py-2 text-sm min-h-[56px]"
                />
                <textarea
                  value={homework}
                  onChange={(e) => setHomework(e.target.value)}
                  placeholder="Үй тапсырмасы"
                  className="w-full border rounded-lg px-3 py-2 text-sm min-h-[56px]"
                />
                <textarea
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  placeholder="Бағалау критерийі"
                  className="w-full border rounded-lg px-3 py-2 text-sm min-h-[56px]"
                />
                <textarea
                  value={resources}
                  onChange={(e) => setResources(e.target.value)}
                  placeholder="Қосымша ресурстар/сілтемелер"
                  className="w-full border rounded-lg px-3 py-2 text-sm min-h-[56px]"
                />
              </div>
            </details>
            <button
              onClick={createLesson}
              className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm"
            >
              Сабақ құру
            </button>
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
                {error}
              </div>
            )}
          </div>
        </details>
      </div>

      <div id="student-create" className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            👥 Оқушы тіркеу (мұғалім арқылы)
          </summary>
          <div className="mt-3 space-y-3">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder="Аты-жөні"
                className="border rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={newStudentUsername}
                onChange={(e) => setNewStudentUsername(e.target.value)}
                placeholder="username"
                className="border rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={newStudentEmail}
                onChange={(e) => setNewStudentEmail(e.target.value)}
                placeholder="email (optional)"
                className="border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="password"
                value={newStudentPassword}
                onChange={(e) => setNewStudentPassword(e.target.value)}
                placeholder="пароль"
                className="border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleCreateStudent}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm"
            >
              Оқушы тіркеу
            </button>
            {createStudentMsg && (
              <div className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2">
                {createStudentMsg}
              </div>
            )}
          </div>
        </details>
      </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium text-slate-700">Сабақтар кітапханасы</div>
            <div className="text-xs text-slate-500">Lumio-style compact grid</div>
          </div>
          {loading ? (
            <div className="text-sm text-slate-500">Жүктелуде...</div>
          ) : filteredLessons.length === 0 ? (
            <div className="text-sm text-slate-500">
              {normalizedSearch ? "Іздеуге сай сабақ табылмады." : "Әзірше сабақ жоқ."}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleLessons.map((l) => (
                <article
                  key={l.id}
                  className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[11px] text-slate-500 truncate">
                      {l.subject || "Пән жоқ"} · {l.grade || "Сынып жоқ"}
                    </div>
                    <div className="text-[10px] text-slate-400 shrink-0">
                      {fmtDate(l.created_at)}
                    </div>
                  </div>

                  <div className="mt-1.5">
                    <div className="text-sm font-semibold text-slate-900 truncate">{l.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {l.topic || "Тақырып жоқ"}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    {l.is_shared && l.share_code ? (
                      <div className="text-[11px] px-2 py-1 rounded-full border bg-slate-50">
                        Code: <span className="font-mono">{l.share_code}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => shareLesson(l.id)}
                        className="h-8 px-3 rounded-full border bg-white text-[11px] hover:bg-slate-50"
                      >
                        🔗 Коды
                      </button>
                    )}
                  </div>

                  <details className="mt-2 rounded-xl border border-slate-100 bg-slate-50/70 px-2.5 py-1.5">
                    <summary className="cursor-pointer text-[11px] font-medium text-slate-700">
                      Басқару
                    </summary>
                    <div className="mt-2 space-y-2">
                      <div className="text-[11px] text-slate-500">Шаблон қосу</div>
                      <div className="flex gap-2">
                        <select
                          value={applyTplFor[l.id] ?? ""}
                          onChange={(e) =>
                            setApplyTplFor((prev) => ({ ...prev, [l.id]: e.target.value }))
                          }
                          className="flex-1 border rounded px-2 py-1 text-[11px]"
                        >
                          <option value="">Template</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              #{t.id} · {t.title}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => void handleApplyTemplate(l.id)}
                          className="h-7 px-2 rounded border bg-white text-[11px]"
                        >
                          Қосу
                        </button>
                      </div>

                      <div className="text-[11px] text-slate-500">Оқушы қосу</div>
                      <div className="flex gap-2">
                        <input
                          value={addStudentInputs[l.id] ?? ""}
                          onChange={(e) =>
                            setAddStudentInputs((prev) => ({ ...prev, [l.id]: e.target.value }))
                          }
                          placeholder="username/email"
                          className="flex-1 border rounded px-2 py-1 text-[11px]"
                        />
                        <button
                          onClick={() => void enrollStudent(l.id)}
                          className="h-7 px-2 rounded border bg-white text-[11px]"
                        >
                          Қосу
                        </button>
                      </div>
                    </div>
                  </details>
                </article>
              ))}
            </div>
          )}
          {!loading && filteredLessons.length > 6 && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllLessons((v) => !v)}
                className="h-9 px-4 rounded-full border border-slate-200 bg-white text-sm hover:bg-slate-50"
              >
                {showAllLessons ? "Қысқарту" : `Барлығын көру (${filteredLessons.length})`}
              </button>
            </div>
          )}
          {addStudentError && (
            <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
              {addStudentError}
            </div>
          )}
          {applyTplMsg && (
            <div className="mt-3 text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2">
              {applyTplMsg}
            </div>
          )}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div id="assignment-create" className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm xl:col-span-1">
            <details>
              <summary className="cursor-pointer text-sm font-medium text-slate-700">📝 Жаңа тапсырма</summary>
              <div className="mt-3 space-y-2">
                <select
                  value={asgLesson}
                  onChange={(e) => setAsgLesson(Number(e.target.value))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Сабақ таңдаңыз
                  </option>
                  {items.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
                <input
                  value={asgTitle}
                  onChange={(e) => setAsgTitle(e.target.value)}
                  placeholder="Тапсырма атауы"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
                <div className="grid gap-2 grid-cols-2">
                  <select
                    value={asgType}
                    onChange={(e) => setAsgType(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="quiz">Quiz (тест)</option>
                    <option value="matching">Matching</option>
                    <option value="sorting">Sorting</option>
                    <option value="poll">Poll</option>
                    <option value="grouping">Grouping</option>
                    <option value="flashcards">Flashcards</option>
                    <option value="crossword">Crossword</option>
                    <option value="slides">Slides</option>
                    <option value="other">Other</option>
                  </select>
                  <select
                    value={asgContentId}
                    onChange={(e) => setAsgContentId(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Template (optional)</option>
                    {templates
                      .filter((t) => !asgType || t.template_type === asgType)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          #{t.id} · {t.title}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="grid gap-2 grid-cols-2">
                  <input
                    type="date"
                    value={asgDueDate}
                    onChange={(e) => setAsgDueDate(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="time"
                    value={asgDueTime}
                    onChange={(e) => setAsgDueTime(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs border rounded px-2 py-1">
                  <input
                    type="checkbox"
                    checked={asgPublished}
                    onChange={(e) => setAsgPublished(e.target.checked)}
                  />
                  Жариялау
                </label>
                <button
                  onClick={createAssignment}
                  disabled={creatingAsg}
                  className="w-full px-4 py-2 rounded-lg bg-sky-600 text-white text-sm"
                >
                  {creatingAsg ? "..." : "Тапсырма құру"}
                </button>
                {asgError && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
                    {asgError}
                  </div>
                )}
              </div>
            </details>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm xl:col-span-2">
            <div className="text-sm font-medium text-slate-700 mb-3">Тапсырмалар</div>
            {loading ? (
              <div className="text-sm text-slate-500">Жүктелуде...</div>
            ) : filteredAssignments.length === 0 ? (
              <div className="text-sm text-slate-500">
                {normalizedSearch ? "Іздеуге сай тапсырма табылмады." : "Әзірше тапсырма жоқ."}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredAssignments.map((a) => (
                  <article
                    key={a.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900 truncate">{a.title}</div>
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                        {a.effective_assignment_type ?? a.assignment_type ?? "other"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 min-h-[30px]">
                      {a.description || "Сипаттама жоқ."}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      Сабақ: {a.lesson_title ?? a.lesson} · Контент: {a.content_id ?? "-"}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Дедлайн: {a.due_at ? new Date(a.due_at).toLocaleString() : "-"}
                    </div>
                    <div className="mt-2 text-[11px]">
                      {a.is_published ? (
                        <span className="text-emerald-700">Жарияланған</span>
                      ) : (
                        <span className="text-amber-700">Жоба</span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => void openAssign(a)}
                        className="h-8 px-2 rounded-lg border bg-white text-[11px] hover:bg-slate-50"
                      >
                        👥 Тағайындау
                      </button>
                      <button
                        onClick={() => void openSubmissions(a)}
                        className="h-8 px-2 rounded-lg border bg-white text-[11px] hover:bg-slate-50"
                      >
                        📥 Жауаптар
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await api.patch(`/lessons/assignments/${a.id}/`, {
                              is_published: !a.is_published,
                            });
                            await load();
                          } catch (e) {
                            console.error(e);
                            setError("Publish өзгертілмеді.");
                          }
                        }}
                        className="col-span-2 h-8 px-2 rounded-lg border bg-white text-[11px] hover:bg-slate-50"
                      >
                        {a.is_published ? "Жабу" : "Жариялау"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSubsFor && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">
              Жауаптар: {showSubsFor.title}
            </div>
            <button
              onClick={() => setShowSubsFor(null)}
              className="text-xs px-2 py-1 rounded border"
            >
              Жабу
            </button>
          </div>
          {submissions.length === 0 ? (
            <div className="text-xs text-slate-500">Әзірше submission жоқ.</div>
          ) : (
            <div className="space-y-2">
              {submissions.map((s) => (
                <div
                  key={s.id}
                  className="border rounded px-2 py-2 bg-white space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span>
                      {s.student_username ?? `Student #${s.student}`} ·{" "}
                      {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "-"}
                    </span>
                    <span className="text-slate-500">#{s.id}</span>
                  </div>
                  {s.text && <div className="text-slate-600">{s.text}</div>}
                  {s.file && (
                    <a
                      href={s.file}
                      className="text-blue-600 underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Файлды көру
                    </a>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      value={s.score ?? ""}
                      onChange={(e) =>
                        setSubmissions((prev) =>
                          prev.map((x) =>
                            x.id === s.id ? { ...x, score: Number(e.target.value) } : x
                          )
                        )
                      }
                      placeholder="Баға"
                      className="border rounded px-2 py-1 text-xs w-24"
                    />
                    <input
                      value={s.feedback ?? ""}
                      onChange={(e) =>
                        setSubmissions((prev) =>
                          prev.map((x) =>
                            x.id === s.id ? { ...x, feedback: e.target.value } : x
                          )
                        )
                      }
                      placeholder="Пікір"
                      className="border rounded px-2 py-1 text-xs flex-1"
                    />
                    <button
                      onClick={() => updateSubmission(s)}
                      className="px-2 py-1 rounded border text-xs"
                      disabled={savingSubId === s.id}
                    >
                      {savingSubId === s.id ? "..." : "💾 Сақтау"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {assignFor && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">
              Тапсырмаға тағайындау: {assignFor.title}
            </div>
            <button
              onClick={() => setAssignFor(null)}
              className="text-xs px-2 py-1 rounded border"
            >
              Жабу
            </button>
          </div>
          {enrollments.length === 0 ? (
            <div className="text-xs text-slate-500">Бұл сабақта студент жоқ.</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-3">
              {enrollments.map((e) => (
                <label
                  key={e.id}
                  className="flex items-center gap-2 text-xs border rounded px-2 py-1 bg-white"
                >
                  <input
                    type="checkbox"
                    checked={selectedStudents.includes(e.student)}
                    onChange={() => toggleStudent(e.student)}
                  />
                  <span>{e.student_username ?? `Student #${e.student}`}</span>
                </label>
              ))}
            </div>
          )}
          <button
            onClick={assignStudents}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm"
            disabled={!selectedStudents.length}
          >
            Тағайындау
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-700 mb-3">Марапаттар</div>
        <div className="border rounded-xl p-3 mb-4 space-y-2 bg-slate-50/40">
          <div className="text-sm font-medium">Марапат беру</div>
          <div className="grid gap-2 md:grid-cols-5">
            <select
              value={rewardLessonId}
              onChange={(e) => setRewardLessonId(Number(e.target.value))}
              className="border rounded px-2 py-1 text-xs"
            >
              <option value="" disabled>
                Сабақ таңдаңыз
              </option>
              {items.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
            <select
              value={selectedRewardStudent}
              onChange={(e) => setSelectedRewardStudent(Number(e.target.value))}
              className="border rounded px-2 py-1 text-xs"
            >
              <option value="" disabled>
                Student таңдау
              </option>
              {enrollments.map((e) => (
                <option key={e.id} value={e.student}>
                  {e.student_username ?? `Student #${e.student}`}
                </option>
              ))}
            </select>
            <input
              value={rewardTitle}
              onChange={(e) => setRewardTitle(e.target.value)}
              placeholder="Reward title"
              className="border rounded px-2 py-1 text-xs"
            />
            <input
              value={rewardDesc}
              onChange={(e) => setRewardDesc(e.target.value)}
              placeholder="Description"
              className="border rounded px-2 py-1 text-xs"
            />
            <select
              value={rewardLevel}
              onChange={(e) => setRewardLevel(e.target.value)}
              className="border rounded px-2 py-1 text-xs"
            >
              <option value="silver">Күміс</option>
              <option value="special">Арнайы</option>
              <option value="gold">Алтын</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              value={rewardIcon}
              onChange={(e) => setRewardIcon(e.target.value)}
              placeholder="Icon"
              className="border rounded px-2 py-1 text-xs w-24"
            />
            <button
              onClick={createReward}
              className="px-3 py-1 rounded border text-xs"
            >
              ➕ Reward беру
            </button>
          </div>
        </div>
        {loading ? (
          <div className="text-xs text-slate-500">Жүктелуде...</div>
        ) : rewards.length === 0 ? (
          <div className="text-xs text-slate-500">Әзірше reward жоқ.</div>
        ) : (
          <div className="space-y-2">
            {rewards.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between text-xs border rounded px-2 py-1 bg-white"
              >
                <span>
                  {r.icon ?? "🏆"} {r.title} · {r.level}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEditReward(r)}
                    className="text-blue-600"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => deleteReward(r.id)}
                    className="text-red-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingRewardId && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-2">
          <div className="text-sm font-medium text-slate-700">Reward edit</div>
          <div className="grid gap-2 md:grid-cols-4">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title"
              className="border rounded px-2 py-1 text-xs"
            />
            <input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description"
              className="border rounded px-2 py-1 text-xs"
            />
            <select
              value={editLevel}
              onChange={(e) => setEditLevel(e.target.value)}
              className="border rounded px-2 py-1 text-xs"
            >
              <option value="silver">Silver</option>
              <option value="special">Special</option>
              <option value="gold">Gold</option>
            </select>
            <input
              value={editIcon}
              onChange={(e) => setEditIcon(e.target.value)}
              placeholder="Icon"
              className="border rounded px-2 py-1 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveEditReward}
              className="px-3 py-1 rounded border text-xs"
            >
              💾 Save
            </button>
            <button
              onClick={() => setEditingRewardId(null)}
              className="px-3 py-1 rounded border text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
