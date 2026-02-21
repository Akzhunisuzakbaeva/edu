import { useEffect } from "react";
import SlideCanvas from "./SlideCanvas";
import SlideNav from "./SlideNav";
import TemplatePanel from "./TemplatePanel";
import { useEditor } from "./store";

export default function EditorPage() {
  const lessonId = 1; // кейін route param

  const {
    slides,
    currentSlideId,
    loadSlides,
    openSlide,
  } = useEditor();

  useEffect(() => {
    void loadSlides(lessonId);
  }, [lessonId, loadSlides]);

  return (
    <div className="grid grid-cols-[320px_1fr] gap-4">
      {/* LEFT */}
      <div className="space-y-4">
        <TemplatePanel
          lessonId={lessonId}
          onApplied={() => loadSlides(lessonId)}
        />

        <div className="p-3 rounded-xl border bg-white/70">
          <div className="font-semibold mb-2">Слайдтар</div>
          <SlideNav
            slides={slides}
            activeSlideId={currentSlideId}
            onSelect={(id) => openSlide(id)}
          />
        </div>
      </div>

      {/* RIGHT */}
      <div className="p-3 rounded-xl border bg-white/50">
        {currentSlideId ? (
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
