import React, { useState, useEffect } from "react";
import "./asyq.css";

const questions = [
  { q: "Python дегеніміз не?", a: "Бағдарламалау тілі" },
  { q: "HTML не үшін қолданылады?", a: "Веб бет құрылымын жасау үшін" },
  { q: "React — бұл ...", a: "Пайдаланушы интерфейсін жасау кітапханасы" },
  { q: "Kazakhstan астанасы?", a: "Астана" },
];

function AsyqGame() {
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (answer.trim().toLowerCase() === questions[current].a.toLowerCase()) {
      setScore(score + 1);
      setMessage("✅ Дұрыс жауап! Бір асық ұттың!");
    } else {
      setMessage("❌ Қате жауап, келесі сұрақ!");
    }
    setAnswer("");
    setTimeout(() => {
      setMessage("");
      if (current < questions.length - 1) {
        setCurrent(current + 1);
      } else {
        setMessage(`Ойын аяқталды! Жиналған асықтар саны: ${score + 1}`);
      }
    }, 1500);
  };

  return (
    <div className="asyq-container">
      <h2>🎯 Асық жинау ойыны</h2>
      <p className="question">{questions[current].q}</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Жауабыңды жаз..."
          required
        />
        <button type="submit">Жауап беру</button>
      </form>
      <p className="message">{message}</p>
      <div className="asyq-display">
        {Array.from({ length: score }).map((_, i) => (
          <div key={i} className="asyq"></div>
        ))}
      </div>
    </div>
  );
}

export default AsyqGame;
