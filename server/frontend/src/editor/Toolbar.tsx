import { useEditor } from "./store";

export default function Toolbar() {
  const { addText, addSticker, addCheckbox, deleteActive } = useEditor();

  return (
    <div className="flex gap-2 p-2 border-b bg-white">
      <button className="px-3 py-1 border rounded" onClick={() => void addText()}>
        ➕ Text
      </button>

      <button className="px-3 py-1 border rounded" onClick={() => void addSticker("🔥")}>
        ➕ Sticker
      </button>

      <button className="px-3 py-1 border rounded" onClick={() => void addCheckbox()}>
        ☑ Checkbox
      </button>

      <button className="px-3 py-1 border rounded" onClick={() => void deleteActive()}>
        🗑 Delete
      </button>
    </div>
  );
}
