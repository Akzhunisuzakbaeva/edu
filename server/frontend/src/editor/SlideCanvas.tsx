// server/frontend/src/editor/EditorPage.tsx
import { useEffect, useState, useCallback } from "react";
import SlideCanvas from "./SlideCanvas";
import SlideNav from "./SlideNav";
import TemplatePanel from "./TemplatePanel";
import { getSlides } from "../api/slide";

type Slide = {
  id: number;
  title?: string;
};

export default function EditorPage() {
  const lessonId = 1;
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeSlideId, setActiveSlideId] = useState<number | null>(null);

  const refreshSlides = useCallback(async () => {
    const list = await getSlides({ lesson: lessonId });
    setSlides(list);

    if (!activeSlideId && list.length) {
      setActiveSlideId(list[0].id);
    }
  }, [lessonId, activeSlideId]);

  useEffect(() => {
    void refreshSlides();
  }, [refreshSlides]);

  return (
    <div className="grid grid-cols-[320px_1fr] gap-4">
      {/* LEFT */}
      <div className="space-y-4">
        <TemplatePanel lessonId={lessonId} onApplied={refreshSlides} />

        <div className="p-3 rounded-xl border bg-white/70">
          <div className="font-semibold mb-2">Слайдтар</div>
          <SlideNav
            slides={slides}
            activeSlideId={activeSlideId}
            onSelect={setActiveSlideId}
          />
        </div>
      </div>

      {/* RIGHT */}
      <div className="p-3 rounded-xl border bg-white/50">
        {activeSlideId ? (
          <SlideCanvas />
        ) : (
          <div className="h-[360px] grid place-items-center text-black/60">
            Бұл lesson ішінде slide жоқ. Сол жақтан шаблон бас.
          </div>
        )}
      </div>
    </div>
  );
}
