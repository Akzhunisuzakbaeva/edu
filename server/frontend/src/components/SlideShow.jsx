// src/components/SlideShow.jsx
import React, { useEffect, useState } from "react";
import Reveal from "reveal.js";
import "reveal.js/dist/reveal.css";
import "reveal.js/dist/theme/black.css";
import { API_BASE_URL } from "../config";

function SlideShow() {
  const [slides, setSlides] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}slide/`)
      .then((res) => res.json())
      .then((data) => {
        setSlides(data);
        console.log("✅ Slides from API:", data);
        setTimeout(() => {
          new Reveal().initialize();
        }, 300);
      })
      .catch((err) => console.error("❌ API error:", err));
  }, []);

  if (slides.length === 0) {
    return <p style={{ textAlign: "center" }}>⏳ Слайдтар жүктеліп жатыр...</p>;
  }

  return (
    <div className="reveal">
      <div className="slides">
        {slides.map((slide) => (
          <section key={slide.id}>
            <h2>{slide.title}</h2>
            <p>{slide.content}</p>
            {slide.image && (
              <img
                src={`${API_BASE_URL}${slide.image}`}
                alt="Slide illustration"
                style={{ maxWidth: "80%", borderRadius: "10px" }}
              />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

export default SlideShow;
