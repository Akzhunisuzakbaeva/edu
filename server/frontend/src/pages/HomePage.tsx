export default function HomePage() {
    return (
      <div className="container py-4">
        <div className="rounded-4 border border-warning-subtle bg-white bg-opacity-75 p-3 p-md-4 shadow-sm">
        <div className="row g-4 align-items-center">
          {/* Сол жақ – текст */}
          <div className="col-lg-6">
            <p className="text-uppercase text-muted small mb-2">
              OquJol Education Platform
            </p>
            <h1 className="fw-bold mb-3">
              Мұғалім мен оқушыға арналған интерактивті веб-платформа
            </h1>
            <p className="text-muted mb-4">
              Мұнда мұғалім сабақ құрып, ойын форматындағы тапсырмалар береді,
              ал оқушы өзінің жеке кабинетінде сабақтар мен прогресті көреді.
            </p>
  
            <div className="d-flex gap-2 mb-3 flex-wrap">
              <a href="/teacher/live" className="btn btn-primary">
                👩‍🏫 Мұғалім панелі
              </a>
              <a href="/student" className="btn btn-outline-primary">
                🎓 Оқушы панелі
              </a>
            </div>
  
            <p className="small text-muted">
              Функциялар: интерактивті слайдтар, ойындар (Quiz, Sorting),
              дедлайнмен тапсырмалар, марапат жүйесі, тірі сабақ режимі.
            </p>
          </div>
  
          {/* Оң жақ – “карточкалар” */}
          <div className="col-lg-6">
            <div className="row g-3">
              <div className="col-12">
                <div className="card shadow-sm">
                  <div className="card-body">
                    <h6 className="card-title mb-1">👩‍🏫 Мұғалім үшін</h6>
                    <p className="card-text small text-muted mb-1">
                      Сабақ жоспарлау, ойын шаблондарын таңдау, Live режимде
                      контент көрсету.
                    </p>
                  </div>
                </div>
              </div>
  
              <div className="col-md-6">
                <div className="card shadow-sm h-100">
                  <div className="card-body">
                    <h6 className="card-title mb-1">🎓 Оқушы үшін</h6>
                    <p className="card-text small text-muted">
                      Жеке кабинет, үй жұмыстары, прогресс пен жетістіктер.
                    </p>
                  </div>
                </div>
              </div>
  
              <div className="col-md-6">
                <div className="card shadow-sm h-100">
                  <div className="card-body">
                    <h6 className="card-title mb-1">📊 Аналитика</h6>
                    <p className="card-text small text-muted">
                      Тест нәтижелері, қатысу тарихы және балл жүйесі бойынша
                      қарапайым аналитика.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div> 
        </div>
      </div>
    );
  }
  
