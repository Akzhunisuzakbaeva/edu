import React, { useEffect, useState } from "react";

export default function QuizGame({ quizId = 1 }) {
  const [quiz, setQuiz] = useState(null);
  const [i, setI] = useState(0);           // current question index
  const [score, setScore] = useState(0);   // points
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/quiz/${quizId}/`)
      .then(r => r.json())
      .then(setQuiz)
      .catch(console.error);
  }, [quizId]);

  if (!quiz) return <div>Жүктеліп жатыр…</div>;
  if (!quiz.questions?.length) return <div>Сұрақтар жоқ</div>;

  const q = quiz.questions[i];

  const choose = (answer) => {
    if (answer.is_correct) setScore(s => s + 1);
    if (i + 1 < quiz.questions.length) {
      setI(i + 1);
    } else {
      setDone(true);
    }
  };

  return (
    <div className="bg-panel rounded-xl p-4 max-w-2xl">
      <h1 className="font-semibold text-lg mb-3">{quiz.title}</h1>

      {!done ? (
        <>
          <div className="mb-2 text-sm text-ink-600">
            Сұрақ {i + 1} / {quiz.questions.length}
          </div>
          <div className="mb-4 font-medium">{q.text}</div>

          <div className="grid gap-2">
            {q.answers.map((a) => (
              <button
                key={a.text}
                onClick={() => choose(a)}
                className="text-left rounded-lg border border-black/10 px-3 py-2 hover:bg-black/5"
              >
                {a.text}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Бітті! 🎉</div>
          <div>
            Ұпай: {score} / {quiz.questions.length}
          </div>
        </div>
      )}
    </div>
  );
}
