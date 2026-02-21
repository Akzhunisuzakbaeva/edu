// frontend/src/components/games/SortingTemplateCreate.tsx
import { useState } from "react";
import axios from "axios";

export default function SortingTemplateCreate() {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<string[]>(["", "", ""]);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChangeItem = (index: number, value: string) => {
    setItems(prev => prev.map((it, i) => (i === index ? value : it)));
  };

  const addItem = () => {
    setItems(prev => [...prev, ""]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        title,
        items,
      };
      const res = await axios.post("/api/templates/sorting/", payload);
      setSuccess("Шаблон сақталды. ID: " + res.data.id);
    } catch (err) {
      console.error(err);
      setError("Қате болды, консольді тексеріңіз.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        «Порядок сортировки» шаблоны
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Тапсырма атауы
          </label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Мысалы: Алгоритм қадамдарын ретпен қой"
            required
          />
        </div>

        {items.map((it, index) => (
          <div key={index}>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              value={it}
              onChange={e => handleChangeItem(index, e.target.value)}
              placeholder={`${index + 1}. Элемент`}
              required
            />
          </div>
        ))}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={addItem}
            className="px-3 py-2 border rounded text-sm"
          >
            + Элемент қосу
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
          >
            Шаблонды сақтау
          </button>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {success && <div className="text-sm text-green-700">{success}</div>}
      </form>
    </div>
  );
}
