import { Link } from "react-router-dom";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          OquJol · Education Platform
        </h1>
        <p className="text-sm text-gray-600 max-w-2xl">
          Мұғалімдерге интерактивті слайдтар, ойын форматындағы тапсырмалар
          және live-сабақ жүргізуге арналған веб-платформа прототипі.
          Төменде мұғалім мен оқушы ағындарының қысқаша сызбасы берілген.
        </p>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Мұғалім ағыны */}
        <section className="border rounded-xl bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
              🧑‍🏫
            </div>
            <div>
              <h2 className="text-lg font-semibold">Мұғалім ағыны</h2>
              <p className="text-xs text-gray-500">
                Сабақты дайындау · ойындарды құру · live-сабақ өткізу
              </p>
            </div>
          </div>

          <ol className="list-decimal list-inside text-sm space-y-1 text-gray-700">
            <li>Сабақ слайдтарын дайындау (Slide Editor)</li>
            <li>Ойын форматындағы тапсырмалар шаблондарын жасау</li>
            <li>Live-сабақты қосу және слайдтарды басқару</li>
          </ol>

          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <CardLink
              to="/editor"
              title="Slide Editor"
              desc="Интерактивті слайдтар: мәтін, сурет, drawing."
            />
            <CardLink
              to="/game/templates/create"
              title="Game Templates"
              desc="Сұрыптау, викторина, т.б. ойын тапсырмалар."
            />
            <CardLink
              to="/teacher/live"
              title="Teacher Live Panel"
              desc="Live сабақ, слайдтарды онлайн басқару."
            />
          </div>
        </section>

        {/* Оқушы ағыны */}
        <section className="border rounded-xl bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              🎧
            </div>
            <div>
              <h2 className="text-lg font-semibold">Оқушы ағыны (прототип)</h2>
              <p className="text-xs text-gray-500">
                Live-сабаққа қосылу · ойындарды орындау
              </p>
            </div>
          </div>

          <ol className="list-decimal list-inside text-sm space-y-1 text-gray-700">
            <li>Мұғалім жіберген live-код арқылы қосылады</li>
            <li>Live-слайдты қарайды</li>
            <li>Quiz / ойын тапсырмаларын орындайды</li>
          </ol>

          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <CardLink
              to="/game/quiz"
              title="Quiz Game"
              desc="Тақырып бойынша викторина тапсырмалары."
            />
            <CardLink
              to="/student/live"
              title="Student Live View"
              desc="Live-сабақты оқушы көзімен көру интерфейсі."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

type CardProps = {
  to: string;
  title: string;
  desc: string;
};

function CardLink({ to, title, desc }: CardProps) {
  return (
    <Link
      to={to}
      className="border rounded-lg px-3 py-3 hover:bg-gray-50 transition flex flex-col justify-between"
    >
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-xs text-gray-600">{desc}</div>
    </Link>
  );
}
