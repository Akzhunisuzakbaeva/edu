import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, registerTeacher } from "../api/auth";

export default function LoginPage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [tName, setTName] = useState("");
  const [tEmail, setTEmail] = useState("");
  const [tUsername, setTUsername] = useState("");
  const [tSchool, setTSchool] = useState("");
  const [tSubject, setTSubject] = useState("");
  const [tPassword, setTPassword] = useState("");
  const [regError, setRegError] = useState<string | null>(null);
  const [regDone, setRegDone] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoginError(null);
      const data = await login(username, password);
      if (data.role === "teacher") {
        navigate("/teacher/lessons");
      } else {
        navigate("/student/dashboard");
      }
    } catch (err) {
      setLoginError("Қате логин немесе пароль");
    }
  };

  return (
    <div className="min-h-[70vh] grid place-items-center">
      <div className="w-full max-w-5xl grid md:grid-cols-[1.2fr,1fr] gap-6 items-stretch">
        <div className="rounded-3xl border bg-white p-6 shadow-sm relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-gradient-to-br from-emerald-200/60 to-sky-200/60 blur-2xl" />
          <div className="absolute -left-16 bottom-0 w-48 h-48 rounded-full bg-gradient-to-br from-amber-200/50 to-rose-200/50 blur-2xl" />
          <div className="relative space-y-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
              OquJol
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Интерактивті сабақ платформасы
            </h1>
            <p className="text-sm text-slate-600">
              Тіркелу тек мұғалімге. Оқушыны мұғалім өзі қосады.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTab("login")}
                className={[
                  "px-4 py-2 rounded-full text-sm border",
                  tab === "login" ? "bg-black text-white" : "bg-white",
                ].join(" ")}
              >
                Кіру
              </button>
              <button
                type="button"
                onClick={() => setTab("register")}
                className={[
                  "px-4 py-2 rounded-full text-sm border",
                  tab === "register" ? "bg-black text-white" : "bg-white",
                ].join(" ")}
              >
                Мұғалім тіркелу
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          {tab === "login" ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="text-sm font-medium">Кіру (мұғалім/оқушы)</div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full px-4 py-2 rounded-lg bg-slate-900 text-white text-sm"
              >
                Кіру
              </button>
              {loginError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
                  {loginError}
                </div>
              )}
              <div className="text-[11px] text-slate-500">
                Оқушы аккаунтын мұғалім жасайды.
              </div>
            </form>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setRegError(null);
                setRegDone(null);
                try {
                  await registerTeacher({
                    username: tUsername,
                    email: tEmail,
                    password: tPassword,
                    full_name: tName,
                    school: tSchool,
                    subject: tSubject,
                  });
                  setRegDone("Тіркелу сәтті ✅ Енді кіруге болады.");
                  setTab("login");
                } catch (e: any) {
                  setRegError(
                    e?.response?.data?.detail ||
                      e?.response?.data?.role ||
                      "Тіркелу кезінде қате болды."
                  );
                }
              }}
              className="space-y-3"
            >
              <div className="text-sm font-medium">Мұғалім тіркелу</div>
              <input
                value={tName}
                onChange={(e) => setTName(e.target.value)}
                placeholder="Толық аты-жөні"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={tUsername}
                onChange={(e) => setTUsername(e.target.value)}
                placeholder="username"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={tEmail}
                onChange={(e) => setTEmail(e.target.value)}
                placeholder="email"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={tSchool}
                onChange={(e) => setTSchool(e.target.value)}
                placeholder="Мектеп"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={tSubject}
                onChange={(e) => setTSubject(e.target.value)}
                placeholder="Пән (информатика немесе математика)"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="password"
                value={tPassword}
                onChange={(e) => setTPassword(e.target.value)}
                placeholder="Пароль"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm"
              >
                Тіркелу
              </button>
              {regError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
                  {regError}
                </div>
              )}
              {regDone && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2">
                  {regDone}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
