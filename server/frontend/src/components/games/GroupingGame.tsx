import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { createSubmission } from "../../api/slide";
import { resolveNextAssignmentPath } from "../../services/assignmentFlow";

type Group = { title: string; items: string[] };
type GroupingTemplate = { id: number; title: string; groups: Group[] };

type PoolItem = { id: string; text: string };

function uid() {
  return Math.random().toString(36).slice(2);
}

export default function GroupingGame() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const templateId = Number(searchParams.get("template")) || null;
  const assignmentId = Number(searchParams.get("assignment")) || null;
  const [template, setTemplate] = useState<GroupingTemplate | null>(null);
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [bins, setBins] = useState<Record<string, PoolItem[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<PoolItem | null>(null);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    const load = async () => {
      try {
        let tpl: any;
        if (templateId) {
          const res = await api.get(`/slide/templates/${templateId}/`);
          tpl = res.data;
        } else {
          const res = await api.post("/slide/templates/preset/", {
            template_type: "grouping",
            title: "Топтарға бөлу",
          });
          tpl = res.data;
        }
        const groups = tpl?.data?.groups ?? tpl?.groups ?? [];
        setTemplate({ id: tpl.id, title: tpl.title, groups });
        const allItems: PoolItem[] = [];
        const newBins: Record<string, PoolItem[]> = {};
        for (const g of groups || []) {
          newBins[g.title] = [];
          for (const it of g.items || []) {
            allItems.push({ id: uid(), text: it });
          }
        }
        setBins(newBins);
        setPool(shuffle(allItems));
      } catch (e) {
        console.error(e);
        setMessage("Шаблонды жүктеу кезінде қате болды.");
      }
    };
    load();
  }, []);

  const onDragStart = (item: PoolItem) => {
    setDragItem(item);
  };

  const onDropToPool = () => {
    if (!dragItem) return;
    setPool((prev) => (prev.find((p) => p.id === dragItem.id) ? prev : [...prev, dragItem]));
    setBins((prev) => {
      const updated: Record<string, PoolItem[]> = {};
      for (const k of Object.keys(prev)) {
        updated[k] = prev[k].filter((p) => p.id !== dragItem.id);
      }
      return updated;
    });
    setDragItem(null);
  };

  const onDropToGroup = (groupTitle: string) => {
    if (!dragItem) return;
    setPool((prev) => prev.filter((p) => p.id !== dragItem.id));
    setBins((prev) => ({
      ...prev,
      [groupTitle]: [...(prev[groupTitle] || []), dragItem],
    }));
    setDragItem(null);
  };

  const check = () => {
    if (!template) return;
    const groups = template.groups || [];
    let ok = true;
    for (const g of groups) {
      const expected = new Set(g.items || []);
      const got = new Set((bins[g.title] || []).map((x) => x.text));
      if (expected.size !== got.size) ok = false;
      for (const item of expected) if (!got.has(item)) ok = false;
    }
    const durationSeconds = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
    void createSubmission({
      template: template.id,
      data: {
        groups: Object.fromEntries(
          Object.entries(bins).map(([k, v]) => [k, v.map((x) => x.text)])
        ),
      },
      duration_seconds: durationSeconds,
    })
      .then(async (res) => {
        const path = await resolveNextAssignmentPath(assignmentId);
        setNextPath(path);
        const correctGroups = (template.groups || [])
          .map((g) => `${g.title}: ${(g.items || []).join(", ")}`)
          .join(" | ");
        if (typeof res?.correct === "boolean") {
          setMessage(res.correct ? "Дұрыс! 👏" : `Дұрыс топтар: ${correctGroups}`);
        } else {
          setMessage(ok ? "Дұрыс! 👏" : `Дұрыс топтар: ${correctGroups}`);
        }
      })
      .catch((e) => {
        console.error("Grouping submit error:", e);
        const correctGroups = (template.groups || [])
          .map((g) => `${g.title}: ${(g.items || []).join(", ")}`)
          .join(" | ");
        setMessage(ok ? "Дұрыс! 👏" : `Дұрыс топтар: ${correctGroups}`);
      });
  };

  if (!template) return <div>Жүктелуде...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">{template.title}</h1>
      <p className="text-sm text-gray-600">
        Элементтерді тиісті топқа апарып тастаңыз.
      </p>

      {/* Pool */}
      <div
        className="p-3 rounded-lg border bg-white/70"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDropToPool}
      >
        <div className="text-sm font-semibold mb-2">Элементтер</div>
        <div className="flex flex-wrap gap-2">
          {pool.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => onDragStart(item)}
              className="px-3 py-1.5 text-sm rounded-full border bg-white cursor-grab"
            >
              {item.text}
            </div>
          ))}
          {pool.length === 0 && (
            <div className="text-xs text-gray-400">Барлығы топтарға бөлінді</div>
          )}
        </div>
      </div>

      {/* Groups */}
      <div className="grid gap-3 md:grid-cols-2">
        {template.groups.map((g) => (
          <div
            key={g.title}
            className="p-3 rounded-lg border bg-white/80 min-h-[120px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDropToGroup(g.title)}
          >
            <div className="text-sm font-semibold mb-2">{g.title}</div>
            <div className="flex flex-wrap gap-2">
              {(bins[g.title] || []).map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => onDragStart(item)}
                  className="px-3 py-1.5 text-sm rounded-full border bg-white cursor-grab"
                >
                  {item.text}
                </div>
              ))}
              {(bins[g.title] || []).length === 0 && (
                <div className="text-xs text-gray-400">Мұнда тастаңыз</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={check}
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

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
