import { useState } from "react";
import QuizCreate from "./QuizCreate";
import SortingCreate from "./SortingCreate";

export default function TemplateCreateHub() {
  const [selected, setSelected] = useState<"quiz" | "sorting" | null>(null);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">

      <h1 className="text-3xl font-bold mb-4">Ойын шаблонын жасау</h1>

      {/* TYPE SELECTOR */}
      <div className="flex gap-4">
        <button
          onClick={() => setSelected("quiz")}
          className={`px-4 py-2 rounded-md border text-sm ${
            selected === "quiz" ? "bg-blue-600 text-white" : ""
          }`}
        >
          Quiz (Сұрақ-жауап)
        </button>

        <button
          onClick={() => setSelected("sorting")}
          className={`px-4 py-2 rounded-md border text-sm ${
            selected === "sorting" ? "bg-blue-600 text-white" : ""
          }`}
        >
          Sorting (Ретпен қою)
        </button>
      </div>

      {/* CONTENT */}
      <div className="border rounded-lg p-4 bg-white/70 shadow-sm">
        {selected === null && (
          <p className="text-gray-600">Жоғарыдан шаблон түрін таңдаңыз.</p>
        )}
        {selected === "quiz" && <QuizCreate />}
        {selected === "sorting" && <SortingCreate />}
      </div>
    </div>
  );
}
