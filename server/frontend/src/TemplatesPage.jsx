import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

export default function TemplatesPage() {
  const [games, setGames] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/games/`)
      .then(res => res.json())
      .then(data => setGames(data))
      .catch(err => console.error("Error:", err));
  }, []);

  return (
    <div style={{ padding: "40px" }}>
      <h1>🎮 Ойын шаблондар</h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
        {games.map(game => (
          <div key={game.id} style={{
            border: "1px solid #ddd",
            borderRadius: "10px",
            padding: "20px",
            width: "250px"
          }}>
            <h3>{game.name}</h3>
            <p>{game.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
