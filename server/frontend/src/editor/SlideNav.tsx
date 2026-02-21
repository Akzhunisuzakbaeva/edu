// server/frontend/src/editor/SlideNav.tsx
import type { Slide } from "./store";

type Props = {
  slides: Slide[];
  activeSlideId: number | null;
  onSelect: (id: number) => void;
};

export default function SlideNav({ slides, activeSlideId, onSelect }: Props) {
  return (
    <div className="space-y-2">
      {slides.map((s) => {
        const isActive = s.id === activeSlideId;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={[
              "w-full text-left px-3 py-2 rounded-lg border text-sm transition",
              isActive
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700",
            ].join(" ")}
          >
            <div className="font-medium">{s.title ?? `Slide #${s.id}`}</div>
            <div className="text-[11px] opacity-70">ID: {s.id}</div>
          </button>
        );
      })}

      {!slides.length && (
        <div className="text-xs text-slate-500">Әзірге slide жоқ.</div>
      )}
    </div>
  );
}
