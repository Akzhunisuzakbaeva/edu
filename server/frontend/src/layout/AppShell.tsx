import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

type Role = "teacher" | "student" | null;

export default function AppShell({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const location = useLocation();

  // localStorage-тен рөлді оқимыз, route өзгерген сайын тексереміз
  useEffect(() => {
    try {
      const stored = localStorage.getItem("role");
      if (stored === "teacher" || stored === "student") {
        setRole(stored);
      } else {
        setRole(null);
      }
    } catch {
      setRole(null);
    }
  }, [location.pathname]);

  const teacherNav = [
    { to: "/", label: "Басты" },
    { to: "/game/quiz", label: "Quiz" },
    { to: "/game/templates/create", label: "Шаблондар" },
    { to: "/teacher/lessons", label: "Сабақтар" },
    { to: "/analytics", label: "Аналитика" },
    { to: "/teacher/live", label: "Тірі сабақ" },
  ];

  const studentNav = [
    { to: "/student", label: "Сабақтарым" },
    { to: "/student/profile", label: "Профилім" },
  ];
  

  const profilePath =
    role === "teacher"
      ? "/teacher/profile"
      : role === "student"
      ? "/student/profile"
      : "/login";

  const profileLabel =
    role === "teacher"
      ? "Мұғалім"
      : role === "student"
      ? "Оқушы"
      : "Кіру";

  const nav = role === "student" ? studentNav : teacherNav;

  const isActive = (path: string) =>
    location.pathname === path ||
    location.pathname.startsWith(path + "/");

  const getHelpText = (path: string) => {
    if (path.startsWith("/game/templates/create")) {
      return "Шаблон жасаңыз → сабаққа қосыңыз. Форманы толтырып «Шаблон құру» басыңыз.";
    }
    if (path.startsWith("/teacher/lessons")) {
      return "Сабақ/тапсырма құрыңыз, шаблон қосыңыз, оқушыны қосыңыз.";
    }
    if (path.startsWith("/game/quiz")) {
      return "Дайын викторинаны таңдаңыз немесе шаблон жасаңыз.";
    }
    if (path.startsWith("/teacher/live")) {
      return "Live сабақ кодын жасап, студентке беріңіз.";
    }
    if (path.startsWith("/analytics")) {
      return "Жеке, топтық және тақырыптық аналитиканы осы жерден қараңыз.";
    }
    if (path.startsWith("/student")) {
      return "Код арқылы сабаққа қосылыңыз және тапсырмаларды орындаңыз.";
    }
    if (path.startsWith("/login")) {
      return "Мұғалім тіркеліп кіреді; студентті мұғалім қосады.";
    }
    return "Нұсқаулық: шаблон → сабақ → тапсырма → оқушы.";
  };

  return (
    <div className="kahoot-kz-app min-h-screen bg-[var(--color-bg)] text-[var(--color-ink-900)]">
      <div className="ornament-bar" />
      <header className="kz-topbar sticky top-0 z-20 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-4">

          {/* ЛОГО / АТАУ */}
          <Link to="/" className="flex items-center gap-2">
            <span className="kz-brand-mark">❖</span>
            <span className="flex flex-col leading-tight">
              <span className="font-bold tracking-tight text-sm">
                OquJol
              </span>
              <span className="text-[11px] text-black/50">
                {role === "student"
                  ? "Teacher & Student Platform · Student"
                  : role === "teacher"
                  ? "Teacher & Student Platform · Teacher"
                  : "Teacher & Student Platform"}
              </span>
            </span>
          </Link>

          {/* НАВИГАЦИЯ */}
          <nav className="flex items-center gap-2 text-sm ml-3 md:ml-6">
  {nav.map((item) => (
    <Link
      key={item.to}
      to={item.to}
      className={[
        "kz-nav-pill",
        isActive(item.to)
          ? "kz-nav-pill--active"
          : "",
      ].join(" ")}
    >
      {item.label}
    </Link>
  ))}
</nav>



          {/* ОҢ ЖАҚ – SEARCH + PROFILE + ROLE */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="help-tooltip"
              data-tooltip={getHelpText(location.pathname)}
              aria-label="Нұсқаулық"
            >
              ?
            </button>

            {role === "teacher" && (
              <div className="hidden sm:block">
                <input
                  placeholder="Іздеу…"
                  className="h-8 w-56 rounded-md border border-black/10 bg-white/85 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            )}

            {/* Профиль / логин */}
            <Link
              to={profilePath}
              className={
                role === "teacher"
                  ? "kz-role-chip kz-role-chip--teacher"
                  : role === "student"
                  ? "kz-role-chip kz-role-chip--student"
                  : "kz-role-chip kz-role-chip--guest"
              }
            >
              {profileLabel}
            </Link>

            {role && (
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem("access");
                    localStorage.removeItem("refresh");
                    localStorage.removeItem("role");
                  } catch {
                    // ignore storage errors
                  }
                  window.location.href = "/login";
                }}
                className="kz-ghost-chip"
              >
                Шығу
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="kz-main mx-auto max-w-7xl px-4 py-4 md:py-5">
        {children}
      </main>
    </div>
  );
}
