// frontend/src/components/games/SortingTemplateList.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

type SortingTemplate = {
  id: number;
  title: string;
  items: string[];
};

export default function SortingTemplateList() {
  const [templates, setTemplates] = useState<SortingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get("/api/templates/sorting/");
        setTemplates(res.data);
      } catch (err) {
        console.error(err);
        setError("Шаблондарды жүктеу кезінде қате болды.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) return <div>Жүктелуде...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        «Порядок сортировки» шаблондары
      </h1>

      <Link
        to="/game/templates/sorting/create"
        className="inline-block mb-4 px-3 py-2 rounded-md border text-sm"
      >
        + Жаңа шаблон жасау
      </Link>

      <ul className="space-y-2">
        {templates.map(t => (
          <li
            key={t.id}
            className="flex items-center justify-between border rounded-md px-3 py-2"
          >
            <div>
              <div className="font-semibold">{t.title}</div>
              <div className="text-xs text-gray-500">
                Элементтер саны: {t.items.length}
              </div>
            </div>
            <Link
              to={`/game/sorting/${t.id}`}
              className="text-sm text-blue-600 underline"
            >
              Ойынды ашу →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
