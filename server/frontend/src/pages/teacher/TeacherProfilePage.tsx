import { useEffect, useState } from "react";
import api from "../../api/axios";
import { getTeacherInsights } from "../../api/personalization";

type TeacherMe = {
  full_name?: string;
  email?: string;
  school?: string;
  subject?: string;
};

type InsightSummary = {
  students_count: number;
  attempts_count: number;
  group_average_score: number;
  total_time_seconds: number;
};

function toHours(seconds: number) {
  return `${(seconds / 3600).toFixed(1)} сағ`;
}

export default function TeacherProfilePage() {
  const [me, setMe] = useState<TeacherMe | null>(null);
  const [summary, setSummary] = useState<InsightSummary | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, insightRes] = await Promise.all([
          api.get("/auth/me/"),
          getTeacherInsights(),
        ]);
        setMe(meRes.data ?? null);
        setSummary(insightRes?.summary ?? null);
      } catch (e) {
        console.error(e);
      }
    };
    void load();
  }, []);

  const statCards = [
    {
      label: "Оқушылар",
      value: String(summary?.students_count ?? 0),
      tone: "bg-sky-50 border-sky-100",
    },
    {
      label: "Әрекет саны",
      value: String(summary?.attempts_count ?? 0),
      tone: "bg-amber-50 border-amber-100",
    },
    {
      label: "Орташа нәтиже",
      value: `${Math.round(summary?.group_average_score ?? 0)}%`,
      tone: "bg-emerald-50 border-emerald-100",
    },
    {
      label: "Жалпы оқу уақыты",
      value: toHours(summary?.total_time_seconds ?? 0),
      tone: "bg-violet-50 border-violet-100",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <section className="kz-ornament-card rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-amber-50/60 p-4 md:p-5 shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <div className="space-y-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">PROFILE</div>
              <h1 className="text-3xl font-semibold tracking-tight">👩‍🏫 Мұғалім профилі</h1>
              <p className="mt-1 text-sm text-slate-500">
                Негізгі ақпарат пен сынып статистикасы.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold mb-2">Негізгі ақпарат</div>
              <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 text-sm">
                <div className="text-slate-600">
                  Аты-жөні: <b className="text-slate-900">{me?.full_name || "-"}</b>
                </div>
                <div className="text-slate-600">
                  Email: <b className="text-slate-900">{me?.email || "-"}</b>
                </div>
                <div className="text-slate-600">
                  Мектеп: <b className="text-slate-900">{me?.school || "-"}</b>
                </div>
                <div className="text-slate-600">
                  Пән: <b className="text-slate-900">{me?.subject || "-"}</b>
                </div>
              </div>
            </div>
          </div>

          <div className="grid content-start gap-3 sm:grid-cols-2">
            {statCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-2xl border p-4 shadow-sm ${card.tone}`}
              >
                <div className="text-[11px] uppercase tracking-[0.1em] text-slate-500">
                  {card.label}
                </div>
                <div className="mt-1 text-2xl font-semibold leading-tight text-slate-900">
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <a href="/teacher/lessons" className="rounded-full border px-3 py-1.5 text-sm hover:bg-slate-50">
            📚 Сабақтар
          </a>
          <a href="/game/quiz" className="rounded-full border px-3 py-1.5 text-sm hover:bg-slate-50">
            🧠 Quiz
          </a>
          <a href="/analytics" className="rounded-full border px-3 py-1.5 text-sm hover:bg-slate-50">
            📊 Аналитика
          </a>
          <a href="/teacher/live" className="rounded-full border px-3 py-1.5 text-sm hover:bg-slate-50">
            🎥 Тірі сабақ
          </a>
        </div>
      </section>
    </div>
  );
}
