import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { getSubmissionStats } from "../../api/slide";
import { getActiveLives } from "../../services/live";

type Template = {
  id: number;
  title: string;
  template_type?: string;
};
type LeaderRow = {
  student_id: number;
  student__username: string;
  count: number;
};

export default function TeacherDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [activeLives, setActiveLives] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const tplRes = await axios.get("/api/slide/templates/");
        const tplList: Template[] = tplRes.data || [];
        setTemplates(tplList);

        const liveRes = await getActiveLives();
        const liveList = liveRes.data ?? liveRes;
        setActiveLives(Array.isArray(liveList) ? liveList.length : 0);

        const results = await Promise.all(
          tplList.map((t) =>
            getSubmissionStats({ template: t.id }).catch(() => null)
          )
        );
        setStats(results.filter(Boolean));
        const lb = await axios.get("/api/lessons/rewards/leaderboard/");
        setLeaderboard(lb.data ?? []);
      } catch (e) {
        console.error(e);
        setError("Деректерді жүктеу кезінде қате болды.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const summary = useMemo(() => {
    const totalSubmissions = stats.reduce((acc, s) => acc + (s.total || 0), 0);
    const correctTypes = new Set(["quiz", "matching", "sorting", "grouping"]);
    const correctTotal = stats.reduce(
      (acc, s) => acc + (correctTypes.has(s.type) ? (s.correct || 0) : 0),
      0
    );
    const correctBase = stats.reduce(
      (acc, s) => acc + (correctTypes.has(s.type) ? (s.total || 0) : 0),
      0
    );
    const correctPercent = correctBase ? Math.round((correctTotal / correctBase) * 100) : 0;
    return { totalSubmissions, correctPercent };
  }, [stats]);

  const byType = useMemo(() => {
    const map: Record<string, { templates: number; submissions: number }> = {};
    for (const s of stats) {
      const key = s.type || "unknown";
      if (!map[key]) map[key] = { templates: 0, submissions: 0 };
      map[key].templates += 1;
      map[key].submissions += s.total || 0;
    }
    return Object.entries(map).map(([type, v]) => ({ type, ...v }));
  }, [stats]);

  return (
    <div className="space-y-5">
      <section className="hub-hero kz-ornament-card">
        <div className="hub-hero__wrap">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
              TEACHER HUB
            </div>
            <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
              👩‍🏫 Мұғалім панелі
            </h1>
            <p className="mt-2 text-sm md:text-base text-slate-600">
              Сабақтарды, live-сессияны және контентті бір жерден басқару.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/teacher/lessons"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold border border-slate-900"
              >
                + Сабақтар хабы
              </Link>
              <Link
                to="/game/templates/create"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl border-2 border-slate-300 bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50"
              >
                Шаблондар
              </Link>
            </div>
          </div>

          <div className="hub-hero__stats sm:grid sm:grid-cols-2 lg:grid-cols-1">
            <div className="hub-stat">
              <div className="hub-stat__num">{templates.length}</div>
              <div className="hub-stat__label">Барлық шаблон</div>
            </div>
            <div className="hub-stat">
              <div className="hub-stat__num">{summary.totalSubmissions}</div>
              <div className="hub-stat__label">Жауап саны</div>
            </div>
            <div className="hub-stat">
              <div className="hub-stat__num">{summary.correctPercent}%</div>
              <div className="hub-stat__label">Орташа дұрыс</div>
            </div>
            <div className="hub-stat">
              <div className="hub-stat__num">{activeLives}</div>
              <div className="hub-stat__label">Белсенді live</div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
          {error}
        </div>
      )}

      <div className="hub-grid">
        <aside className="hub-side space-y-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Қысқа жол</div>
            <div className="text-xs text-slate-500">Бір батырмамен негізгі беттер</div>
          </div>
          <Link to="/teacher/live" className="block w-full rounded-xl border px-3 py-2 text-sm bg-white hover:bg-slate-50">
            🎥 Тірі сабақ
          </Link>
          <Link to="/editor" className="block w-full rounded-xl border px-3 py-2 text-sm bg-white hover:bg-slate-50">
            🧩 Слайд редакторы
          </Link>
          <Link to="/analytics" className="block w-full rounded-xl border px-3 py-2 text-sm bg-white hover:bg-slate-50">
            📊 Аналитика
          </Link>
          <Link to="/game/quiz" className="block w-full rounded-xl border px-3 py-2 text-sm bg-white hover:bg-slate-50">
            🧠 Quiz
          </Link>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">MVP ескерту</div>
            <div className="mt-1 text-xs text-slate-700">
              Live, редактор және аналитика бір ағымға біріктірілген.
            </div>
          </div>
        </aside>

        <div className="hub-main">
          <section className="hub-section">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-base font-semibold text-slate-900">Негізгі модульдер</div>
              <div className="text-xs text-slate-500">Lumio/Kahoot формат</div>
            </div>
            <div className="hub-cards xl:grid-cols-2">
              <Link
                to="/teacher/live"
                className="group rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between">
                  <div className="text-base font-semibold text-slate-900">🎥 Тірі сабақ</div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                    live
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">Презентацияны оқушыларға нақты уақытта көрсету.</p>
                <div className="mt-3 text-sm font-semibold text-rose-700 group-hover:text-rose-800">Ашу →</div>
              </Link>

              <Link
                to="/editor"
                className="group rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 hover:shadow-sm transition"
              >
                <div className="text-base font-semibold text-slate-900">🧩 Слайд редакторы</div>
                <p className="mt-2 text-sm text-slate-600">Интерактивті слайдтар мен тапсырмалар құру.</p>
                <div className="mt-3 text-sm font-semibold text-blue-700 group-hover:text-blue-800">Ашу →</div>
              </Link>

              <Link
                to="/analytics"
                className="group rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 hover:shadow-sm transition"
              >
                <div className="text-base font-semibold text-slate-900">📊 Аналитика</div>
                <p className="mt-2 text-sm text-slate-600">Топ/жеке статистика және pre/post эксперимент.</p>
                <div className="mt-3 text-sm font-semibold text-emerald-700 group-hover:text-emerald-800">Ашу →</div>
              </Link>

              <Link
                to="/teacher/lessons"
                className="group rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 hover:shadow-sm transition"
              >
                <div className="text-base font-semibold text-slate-900">📚 Сабақтар</div>
                <p className="mt-2 text-sm text-slate-600">Сабақ құру, тапсырма, оқушы, марапат.</p>
                <div className="mt-3 text-sm font-semibold text-amber-700 group-hover:text-amber-800">Ашу →</div>
              </Link>
            </div>
          </section>

          <section className="hub-section">
            <div className="text-base font-semibold text-slate-900 mb-3">Түрлері бойынша</div>
            {loading ? (
              <div className="text-xs text-slate-500">Жүктелуде...</div>
            ) : byType.length ? (
              <div className="hub-cards xl:grid-cols-3">
                {byType.map((t) => (
                  <div key={t.type} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-sm font-semibold capitalize">{t.type}</div>
                    <div className="text-xs text-slate-500 mt-1">Шаблон: {t.templates}</div>
                    <div className="text-xs text-slate-500">Жауап: {t.submissions}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">Әзірге дерек жоқ.</div>
            )}
          </section>

          <section className="hub-section">
            <div className="text-base font-semibold text-slate-900 mb-3">🏅 Үздіктер</div>
            {loading ? (
              <div className="text-xs text-slate-500">Жүктелуде...</div>
            ) : leaderboard.length ? (
              <div className="hub-cards xl:grid-cols-3">
                {leaderboard.slice(0, 9).map((r, idx) => (
                  <div key={r.student_id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    <div className="font-semibold">
                      {idx + 1}. {r.student__username ?? `Оқушы #${r.student_id}`}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Белсенділік: {r.count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">Әзірге дерек жоқ.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
