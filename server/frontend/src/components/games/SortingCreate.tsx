// frontend/src/components/games/SortingCreate.tsx
import { useState } from "react";
import axios from "axios";

type SortingItem = { text: string; order: number };

export default function SortingCreate() {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<SortingItem[]>([
    { text: "", order: 1 },
    { text: "", order: 2 },
    { text: "", order: 3 },
  ]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const updateItem = (index: number, value: string) => {
    setItems(prev =>
      prev.map((it, i) =>
        i === index ? { ...it, text: value } : it
      )
    );
  };

  const addItem = () => {
    setItems(prev => [
      ...prev,
      { text: "", order: prev.length + 1 },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    try {
      setSaving(true);

      const payload = {
        title,
        items,           // 🔥 бұрынғы config емес, тікелей items
      };

      // ✅ ЖАҢА ДҰРЫС URL (games1/urls.py-ға сай)
      const res = await axios.post(
        "/api/games/templates/sorting/create/",
        payload
      );

      setMsg("Шаблон сақталды. ID: " + res.data.id);
      setTitle("");
      setItems([
        { text: "", order: 1 },
        { text: "", order: 2 },
        { text: "", order: 3 },
      ]);
    } catch (err) {
      console.error(err);
      setMsg("Қате болды, консольді тексеріңіз.");
    } finally {
      setSaving(false);
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
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Мысалы: Алгоритм қадамдарын ретпен қой"
            required
          />
        </div>

        {items.map((item, index) => (
          <div key={index} className="flex gap-2 items-center">
            <span className="w-10 text-sm text-gray-500">
              {index + 1}.
            </span>
            <input
              className="flex-1 border rounded-md px-3 py-2 text-sm"
              value={item.text}
              onChange={e => updateItem(index, e.target.value)}
              placeholder={`Элемент ${index + 1}`}
              required
            />
          </div>
        ))}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={addItem}
            className="px-3 py-2 rounded-md border text-sm"
          >
            + Элемент қосу
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50"
          >
            {saving ? "Сақталып жатыр…" : "Шаблонды сақтау"}
          </button>
        </div>

        {msg && <div className="text-sm mt-2">{msg}</div>}
      </form>
    </div>
  );
}
