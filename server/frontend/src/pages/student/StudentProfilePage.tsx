import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import { getMyStudentProfile, updateMyStudentProfile } from "../../api/personalization";

type Reward = {
  id: number;
  title: string;
  description: string;
  level: "gold" | "silver" | "special";
  icon: string;
};

type LeaderRow = {
  student_id: number;
  student__username: string;
  count: number;
};

type TopicMetric = {
  topic: string;
  avg_score: number;
  attempts: number;
};

type TrajectoryNode = {
  id: number;
  lesson: number;
  lesson_title?: string;
  topic: string;
  status: "locked" | "unlocked" | "in_progress" | "review" | "completed" | string;
  mastery: number;
  recommendation?: string;
};

type StudentProfile = {
  learning_level?: string;
  interest_focus?: string;
  preferred_formats?: string[];
  learning_goals?: string;
  average_score?: number;
  completion_rate?: number;
  total_points?: number;
  total_time_seconds?: number;
  weak_topics?: TopicMetric[];
  strong_topics?: TopicMetric[];
  progress_history?: Array<{ date: string; topic: string; score: number }>;
  last_recommendation?: string;
  trajectory?: TrajectoryNode[];
};

type StudentMe = {
  full_name?: string;
  email?: string;
  school?: string;
  subject?: string;
};

function fmtHours(totalSeconds?: number) {
  const value = totalSeconds || 0;
  const hours = value / 3600;
  return `${hours.toFixed(1)} сағ`;
}

export default function StudentProfilePage() {
  const [me, setMe] = useState<StudentMe | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [level, setLevel] = useState<"all" | "gold" | "silver" | "special">("all");
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [interestFocus, setInterestFocus] = useState("");
  const [preferredFormatsText, setPreferredFormatsText] = useState("");
  const [learningGoals, setLearningGoals] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async (refresh = true) => {
    try {
      const [meRes, rewardsRes, lbRes, profileRes] = await Promise.all([
        api.get("/auth/me/"),
        api.get("/lessons/rewards/"),
        api.get("/lessons/rewards/leaderboard/"),
        getMyStudentProfile(refresh),
      ]);

      setMe(meRes.data ?? null);
      setRewards(rewardsRes.data ?? []);
      setLeaderboard(lbRes.data ?? []);
      setProfile(profileRes ?? null);
      setInterestFocus(profileRes?.interest_focus || "");
      setPreferredFormatsText((profileRes?.preferred_formats || []).join(", "));
      setLearningGoals(profileRes?.learning_goals || "");
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    void load(true);
  }, []);

  const filteredRewards = useMemo(() => {
    if (level === "all") return rewards;
    return rewards.filter((r) => r.level === level);
  }, [rewards, level]);

  const saveProfile = async () => {
    setMsg(null);
    setSaving(true);
    try {
      const preferredFormats = preferredFormatsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      await updateMyStudentProfile({
        interest_focus: interestFocus.trim(),
        preferred_formats: preferredFormats,
        learning_goals: learningGoals.trim(),
      });
      setMsg("Профиль жаңартылды ✅");
      await load(true);
    } catch (e) {
      console.error(e);
      setMsg("Жаңарту кезінде қате болды.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">👤 Оқушы профилі</h1>

      <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
        <div className="text-sm font-semibold mb-3">Негізгі ақпарат</div>
        <div className="grid gap-2 md:grid-cols-2 text-sm">
          <div>Аты-жөні: <b>{me?.full_name || "-"}</b></div>
          <div>Email: <b>{me?.email || "-"}</b></div>
          <div>Мектеп: <b>{me?.school || "-"}</b></div>
          <div>Бағыты: <b>{me?.subject || "-"}</b></div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="text-xs text-slate-500">Деңгей</div>
          <div className="text-lg font-semibold">{profile?.learning_level || "-"}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="text-xs text-slate-500">Орташа балл</div>
          <div className="text-lg font-semibold">
            {Math.round((profile?.average_score || 0) * 100)}%
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="text-xs text-slate-500">Жинақ ұпайы</div>
          <div className="text-lg font-semibold">{profile?.total_points || 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="text-xs text-slate-500">Оқу уақыты</div>
          <div className="text-lg font-semibold">{fmtHours(profile?.total_time_seconds)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm space-y-3">
        <div className="text-sm font-semibold text-slate-700">Персонализация параметрлері</div>
        <input
          value={interestFocus}
          onChange={(e) => setInterestFocus(e.target.value)}
          placeholder="Қызығушылық бағыты (мыс: математика, робототехника)"
          className="w-full border rounded px-3 py-2 text-sm"
        />
        <input
          value={preferredFormatsText}
          onChange={(e) => setPreferredFormatsText(e.target.value)}
          placeholder="Қалаған форматтар (мыс: quiz, flashcards, video)"
          className="w-full border rounded px-3 py-2 text-sm"
        />
        <textarea
          value={learningGoals}
          onChange={(e) => setLearningGoals(e.target.value)}
          placeholder="Оқу мақсатыңыз"
          className="w-full border rounded px-3 py-2 text-sm min-h-[90px]"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveProfile}
            disabled={saving}
            className="px-4 py-2 rounded bg-sky-600 text-white text-sm disabled:opacity-50"
          >
            {saving ? "Сақталуда..." : "Сақтау"}
          </button>
          <button
            type="button"
            onClick={() => void load(true)}
            className="px-4 py-2 rounded border text-sm"
          >
            Қайта есептеу
          </button>
        </div>
        {msg && <div className="text-xs text-slate-600">{msg}</div>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white rounded-xl border border-rose-100 p-4 shadow-sm">
          <div className="text-sm font-semibold text-rose-700 mb-2">Қиын тақырыптар</div>
          {profile?.weak_topics?.length ? (
            <div className="space-y-2">
              {profile.weak_topics.slice(0, 6).map((item) => (
                <div key={item.topic} className="text-sm">
                  {item.topic} · {Math.round((item.avg_score || 0) * 100)}%
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500">Әзірге жоқ.</div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
          <div className="text-sm font-semibold text-emerald-700 mb-2">Күшті тақырыптар</div>
          {profile?.strong_topics?.length ? (
            <div className="space-y-2">
              {profile.strong_topics.slice(0, 6).map((item) => (
                <div key={item.topic} className="text-sm">
                  {item.topic} · {Math.round((item.avg_score || 0) * 100)}%
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500">Әзірге жоқ.</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <div className="text-sm font-semibold mb-2">Жеке оқу траекториясы</div>
        {profile?.trajectory?.length ? (
          <div className="space-y-2">
            {profile.trajectory.map((node) => (
              <div key={node.id} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{node.lesson_title || node.topic}</div>
                  <div className="text-xs text-slate-500">{node.recommendation}</div>
                </div>
                <div className="text-xs uppercase tracking-wide text-slate-600">{node.status}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500">Траектория әлі қалыптаспаған.</div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <div className="text-sm font-semibold mb-2">Прогресс тарихы</div>
        {profile?.progress_history?.length ? (
          <div className="space-y-2">
            {profile.progress_history.slice(-10).map((row, idx) => (
              <div key={`${row.date}-${idx}`} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{row.date} · {row.topic}</span>
                  <span>{Math.round(row.score)}%</span>
                </div>
                <div className="h-2 rounded bg-slate-100">
                  <div className="h-2 rounded bg-sky-500" style={{ width: `${Math.max(0, Math.min(100, row.score))}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500">Әзірге тарих жоқ.</div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">🏆 Марапаттар</h2>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as any)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="all">Барлығы</option>
            <option value="gold">Алтын</option>
            <option value="silver">Күміс</option>
            <option value="special">Арнайы</option>
          </select>
        </div>

        {filteredRewards.length === 0 ? (
          <div className="text-sm text-slate-500">Әзірге марапат жоқ.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredRewards.map((reward) => (
              <div key={reward.id} className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
                <div className="text-3xl mb-2">{reward.icon}</div>
                <div className="font-medium">{reward.title}</div>
                <div className="text-sm text-black/60">{reward.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-black/10 p-4 shadow-sm">
        <div className="text-sm font-medium mb-2">🏅 Үздіктер</div>
        {leaderboard.length === 0 ? (
          <div className="text-xs text-slate-500">Әзірге дерек жоқ.</div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((row, idx) => (
              <div key={row.student_id} className="flex items-center justify-between text-sm">
                <span>
                  {idx + 1}. {row.student__username ?? `Оқушы #${row.student_id}`}
                </span>
                <span className="font-mono">{row.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {profile?.last_recommendation && (
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 text-sm text-sky-800">
          Ұсыныс: {profile.last_recommendation}
        </div>
      )}
    </div>
  );
}
