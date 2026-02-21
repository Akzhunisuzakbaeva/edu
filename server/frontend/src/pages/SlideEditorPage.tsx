import { useMemo, useEffect } from "react";
import SlideCanvas from "../editor/SlideCanvas";
import { useEditor } from "../editor/store";

export default function SlideEditorPage(){
  const slideId = useMemo(()=>Number(new URLSearchParams(location.search).get("slide")||1),[]);
  const { addText, addSticker, addImage, activeId, remove } = useEditor();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && activeId) remove(activeId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, remove]);

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>)=>{
    const f = e.target.files?.[0]; if(!f) return;
    const url = URL.createObjectURL(f);
    addImage(url);
    e.target.value = "";
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Left thumbnails */}
      <div className="col-span-2 card p-3">
        <div className="font-semibold mb-2">Slides</div>
        <div className="space-y-2">
          <div className="h-20 bg-[var(--color-bg)] rounded-lg" />
          <div className="h-20 bg-[var(--color-bg)] rounded-lg" />
        </div>
      </div>

      {/* Center editor */}
      <div className="col-span-7 card p-3">
        <div className="flex items-center gap-2 mb-3">
          <button className="btn" onClick={addText}>+ Text</button>
          <label className="btn cursor-pointer">
            Image <input type="file" className="hidden" onChange={onPickImage}/>
          </label>
          <button className="icon-btn" onClick={()=>addSticker("⭐")}>⭐</button>
          <button className="icon-btn" onClick={()=>addSticker("✅")}>✅</button>
          <button className="icon-btn" onClick={()=>addSticker("💡")}>💡</button>
          <div className="ml-auto text-[13px] text-[var(--color-ink-400)]">Slide #{slideId}</div>
        </div>

        <SlideCanvas/>
      </div>

      {/* Right inspector (әзірге info) */}
      <div className="col-span-3 card p-3">
        <div className="font-semibold mb-2">Inspector</div>
        <div className="text-[13px] text-[var(--color-ink-600)]">
          Объектіні таңдаңыз. Delete — өшіру. Grid snap: 8px.
        </div>
      </div>
    </div>
  );
}
