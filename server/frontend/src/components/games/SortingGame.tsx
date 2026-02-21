// frontend/src/components/games/SortingGame.tsx
import { useEffect, useState } from "react";
import api from "../../api/axios";
import axios from "axios";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createSubmission } from "../../api/slide";
import { useRef } from "react";
import { resolveNextAssignmentPath } from "../../services/assignmentFlow";

type SortingTemplate = {
  id: number;
  title: string;
  items: string[];
};

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function SortingGame() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const assignmentId = Number(searchParams.get("assignment")) || null;
  const [template, setTemplate] = useState<SortingTemplate | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/slide/templates/${id}/`);
        const tpl = res.data;
        const itemsList = tpl?.data?.items ?? tpl?.items ?? [];
        setTemplate({
          id: tpl.id,
          title: tpl.title,
          items: itemsList,
        });
        setItems(shuffle(itemsList));
      } catch (err) {
        // fallback to legacy sorting templates endpoint
        try {
          const legacy = await axios.get(`/api/templates/sorting/${id}/`);
          setTemplate(legacy.data);
          setItems(shuffle(legacy.data.items));
        } catch (e) {
          console.error(e);
          setMessage("Шаблонды жүктеу кезінде қате болды.");
        }
      }
    };
    load();
  }, [id]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    setItems(prev => {
      const copy = [...prev];
      [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
      return copy;
    });
  };

  const moveDown = (index: number) => {
    setItems(prev => {
      if (index === prev.length - 1) return prev;
      const copy = [...prev];
      [copy[index + 1], copy[index]] = [copy[index], copy[index + 1]];
      return copy;
    });
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    setItems(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(dragIndex, 1);
      copy.splice(index, 0, moved);
      return copy;
    });
    setDragIndex(null);
  };

  const checkOrder = () => {
    if (!template) return;
    const isCorrect = template.items.every(
      (item, idx) => item === items[idx]
    );
    const durationSeconds = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
    void createSubmission({
      template: template.id,
      data: { order: items },
      duration_seconds: durationSeconds,
    })
      .then(async (res) => {
        const path = await resolveNextAssignmentPath(assignmentId);
        setNextPath(path);
        const correctOrder = template.items.join(" -> ");
        if (typeof res?.correct === "boolean") {
          setMessage(res.correct ? "Керемет! Дұрыс рет 👏" : `Дұрыс реттілік: ${correctOrder}`);
        } else {
          setMessage(
            isCorrect
              ? "Керемет! Қадамдарды дұрыс реттедің 👏"
              : `Дұрыс реттілік: ${correctOrder}`
          );
        }
      })
      .catch((e) => {
        console.error("Sorting submit error:", e);
        const correctOrder = template.items.join(" -> ");
        setMessage(isCorrect ? "Керемет! Қадамдарды дұрыс реттедің 👏" : `Дұрыс реттілік: ${correctOrder}`);
      });
  };

  if (!template) return <div>Жүктелуде...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">
        {template.title} 🔢
      </h1>

      <p className="text-sm text-gray-600">
        Элементтерді дұрыс реттікпен орналастыр.
      </p>

      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={index}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(index)}
            className={[
              "flex items-center gap-2 border rounded-md px-3 py-2 bg-white/70",
              dragIndex === index ? "opacity-60" : "",
            ].join(" ")}
          >
            <span className="w-6 text-right text-xs text-gray-500">
              {index + 1}
            </span>
            <span className="flex-1">{item}</span>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => moveUp(index)}
                className="text-xs border rounded px-1"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveDown(index)}
                className="text-xs border rounded px-1"
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={checkOrder}
        className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm"
      >
        Тексеру
      </button>

      {message && <div className="text-sm mt-2">{message}</div>}
      {nextPath && (
        <button
          type="button"
          onClick={() => navigate(nextPath)}
          className="px-4 py-2 rounded-md border text-sm"
        >
          Келесі тапсырма
        </button>
      )}
    </div>
  );
}
