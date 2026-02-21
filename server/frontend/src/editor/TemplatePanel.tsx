import { useState } from "react";
import {
  applyTemplate,
  createPresetTemplate,
  TemplateType,
} from "../api/templates";
import { useEditor } from "./store";

const TEMPLATES: { type: TemplateType; title: string; desc: string }[] = [
  { type: "quiz", title: "Quiz", desc: "Алгоритм ұғымы (инфо)" },
  { type: "matching", title: "Matching", desc: "Формула ↔ атауы (мат)" },
  { type: "flashcards", title: "Flashcards", desc: "Терминдер (инфо/мат)" },
  { type: "poll", title: "Poll", desc: "Есеп шығару тәсілдері" },
  { type: "crossword", title: "Crossword", desc: "Алгоритм термині" },
  { type: "sorting", title: "Sorting", desc: "Қадамдарды дұрыс реттеу" },
  { type: "grouping", title: "Grouping", desc: "Топтарға бөлу" },
];

export default function TemplatePanel({
  lessonId,
  onApplied,
}: {
  lessonId: number;
  onApplied?: () => void;
}) {
  const { openSlide } = useEditor();
  const [loadingType, setLoadingType] = useState<TemplateType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateAndApply = async (type: TemplateType) => {
    try {
      setLoadingType(type);
      setError(null);
      const tpl = await createPresetTemplate({ template_type: type });
      const applied = await applyTemplate(tpl.id, { lesson_id: lessonId });
      const firstSlide = applied.created_slides?.[0];
      if (firstSlide?.id != null) {
        await openSlide(firstSlide.id);
      }
      onApplied?.();
    } catch (e) {
      console.error("Template apply error:", e);
      setError("Template қолданғанда қате шықты. Консольді тексеріңіз.");
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">Шаблондар</div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </div>
      )}

      {TEMPLATES.map((t) => (
        <button
          key={t.type}
          onClick={() => void handleCreateAndApply(t.type)}
          disabled={loadingType === t.type}
          className="w-full text-left px-3 py-2 rounded-lg border bg-white/80 hover:bg-white disabled:opacity-50"
        >
          <div className="text-sm font-medium">
            {t.title} {loadingType === t.type ? "..." : ""}
          </div>
          <div className="text-xs opacity-70">{t.desc}</div>
        </button>
      ))}
    </div>
  );
}
