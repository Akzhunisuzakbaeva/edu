import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import SlideShow from "./components/SlideShow.jsx";
import AsyqGame from "./components/games/AsyqGame.jsx";

function App() {
  return (
    <Router>
      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <h1>🎓 Edu Platform</h1>
        <nav style={{ marginBottom: "20px" }}>
          <Link to="/slides" style={{ marginRight: "15px" }}>📑 Слайдтар</Link>
          <Link to="/games">🎮 Ойындар</Link>
        </nav>

        <Routes>
          <Route path="/slides" element={<SlideShow />} />
          <Route path="/games" element={<AsyqGame />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
