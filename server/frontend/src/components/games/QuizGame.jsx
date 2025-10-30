import React, { useState } from "react";

const QuizGame = ({ questions }) => {
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const handleAnswer = (correct) => {
    if (correct) setScore(score + 1);
    const next = current + 1;
    if (next < questions.length) {
      setCurrent(next);
    } else {
      setFinished(true);
    }
  };

  if (finished) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold">Нәтиже</h2>
        <p>Сен {questions.length}-ден {score} дұрыс жауап бердің!</p>
      </div>
    );
  }

  const q = questions[current];
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">{q.question}</h2>
      <div className="grid grid-cols-2 gap-3">
        {q.options.map((opt, i) => (
          <button
            key={i}
            className="bg-blue-500 text-white p-3 rounded-xl hover:bg-blue-600"
            onClick={() => handleAnswer(opt === q.correct)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuizGame;
