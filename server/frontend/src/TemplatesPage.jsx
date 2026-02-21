export default function TemplatesPage() {
  return (
    <div className="container py-4">

      {/* Title + description */}
      <div className="text-center mb-3">
  <h1 className="fw-bold fs-4 mb-1">🎮 Ойын шаблондарын таңдау</h1>
  <p className="text-muted small mb-0">
    Мұғалім ойын форматтарын осы беттен таңдай алады.
  </p>
</div>

      <div className="row g-4">

        {/* SORTING */}
        <div className="col-md-6 col-lg-4">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <h5 className="card-title">🔀 Сұрыптау ойыны</h5>
              <p className="card-text">
                Элементтерді дұрыс реттілікке орналастыру. Алгоритм қадамдары, тарихи оқиғалар және т.б.
              </p>
              <a
                href="/game/templates/sorting/create"
                className="btn btn-primary w-100"
              >
                Шаблонды ашу
              </a>
            </div>
          </div>
        </div>

        {/* QUIZ */}
        <div className="col-md-6 col-lg-4">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <h5 className="card-title">❓ Quiz (викторина)</h5>
              <p className="card-text">
                Бір дұрыс жауабы бар тест. Бірнеше жауап нұсқасын қолдайды.
              </p>
              <a
                href="/game/quiz"
                className="btn btn-success w-100"
              >
                Викториналарды көру
              </a>
            </div>
          </div>
        </div>

        {/* MATCH */}
        <div className="col-md-6 col-lg-4">
          <div className="card h-100 shadow-sm border-secondary">
            <div className="card-body">
              <h5 className="card-title">🧩 Сәйкестендіру</h5>
              <p className="card-text">
                Сөздер мен анықтамаларды, суреттер мен ұғымдарды drag &amp; drop арқылы сәйкестендіру.
              </p>
              <button className="btn btn-outline-secondary w-100" disabled>
                Жақында қосылады
              </button>
            </div>
          </div>
        </div>

        {/* GROUP */}
        <div className="col-md-6 col-lg-4">
          <div className="card h-100 shadow-sm border-secondary">
            <div className="card-body">
              <h5 className="card-title">📦 Топтастыру</h5>
              <p className="card-text">
                Ұқсас ұғымдарды бір топқа біріктіру. Mind–map стиліндегі ойын.
              </p>
              <a
                href="/game/grouping"
                className="btn btn-outline-secondary w-100"
              >
                Ойынды ашу
              </a>
            </div>
          </div>
        </div>

        {/* COMPARE NUMBERS */}
        <div className="col-md-6 col-lg-4">
          <div className="card h-100 shadow-sm border-secondary">
            <div className="card-body">
              <h5 className="card-title">🔢 Сандарды салыстыру</h5>
              <p className="card-text">
                Кіші/үлкен, тең, интервалдар бойынша математикалық ойын форматы.
              </p>
              <button className="btn btn-outline-secondary w-100" disabled>
                Жақында қосылады
              </button>
            </div>
          </div>
        </div>

        {/* IMAGE QUESTIONS */}
        <div className="col-md-6 col-lg-4">
          <div className="card h-100 shadow-sm border-secondary">
            <div className="card-body">
              <h5 className="card-title">🖼️ Суретке байланысты сұрақтар</h5>
              <p className="card-text">
                Суретке қарап жауап беру, маңызды детальдарды табу, медиа-талдау ойындары.
              </p>
              <button className="btn btn-outline-secondary w-100" disabled>
                Жақында қосылады
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
