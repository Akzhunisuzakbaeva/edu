// server/frontend/src/editor/store.ts
import { create } from "zustand";
import { getSlides } from "../api/slide"; // сенде бар
// Егер объекттерді backend-тен жүктеу/сақтау кейін керек болса, осы жерге api қосасың.

export type Slide = {
  id: number;
  title?: string;
};

export type SlideObject = {
  id: number;
  type: "text" | "image" | "sticker" | "checkbox";
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;

  text?: string;
  src?: string;
  sticker?: string;
  checked?: boolean;
  label?: string;
};

type EditorState = {
  // slides
  slides: Slide[];
  currentSlideId: number | null;

  loadSlides: (lessonId: number) => Promise<void>;
  openSlide: (slideId: number) => void;

  // canvas objects (әзірге локал)
  objects: SlideObject[];
  activeId?: number;

  // UI helpers
  snap: boolean;
  grid: number;

  setActive: (id?: number) => void;
  bringToFront: (id: number) => void;

  patchLocalOnly: (id: number, patch: Partial<SlideObject>) => void;
  patch: (id: number, patch: Partial<SlideObject>) => Promise<void>;

  // toolbar actions
  addText: () => Promise<void>;
  addSticker: (emoji?: string) => Promise<void>;
  addCheckbox: () => Promise<void>;
  deleteActive: () => Promise<void>;
};

let localObjectId = 1000; // локал id генератор

function nextId() {
  localObjectId += 1;
  return localObjectId;
}

export const useEditor = create<EditorState>((set, get) => ({
  // slides
  slides: [],
  currentSlideId: null,

  loadSlides: async (lessonId: number) => {
    const list = await getSlides({ lesson: lessonId });
    set({ slides: list });

    const { currentSlideId } = get();
    if (!currentSlideId && list.length) {
      set({ currentSlideId: list[0].id });
    }
    if (currentSlideId && !list.some((s) => s.id === currentSlideId)) {
      set({ currentSlideId: list.length ? list[0].id : null });
    }
  },

  openSlide: (slideId: number) => {
    set({ currentSlideId: slideId });
    // Келесі қадам: осы slideId үшін object-терді backend-тен жүктеу
    // Қазір: локал объекттерді сол күйі қалдырамыз (немесе қалаусаң тазалаймыз)
  },

  // objects
  objects: [],
  activeId: undefined,

  snap: true,
  grid: 8,

  setActive: (id) => set({ activeId: id }),

  bringToFront: (id) =>
    set((s) => {
      const maxZ = Math.max(0, ...s.objects.map((o) => o.z ?? 0));
      return {
        objects: s.objects.map((o) =>
          o.id === id ? { ...o, z: maxZ + 1 } : o
        ),
      };
    }),

  patchLocalOnly: (id, patch) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    })),

  patch: async (id, patch) => {
    // кейін API save
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  },

  // toolbar
  addText: async () => {
    const maxZ = Math.max(0, ...get().objects.map((o) => o.z ?? 0));
    const id = nextId();
    set((s) => ({
      objects: [
        ...s.objects,
        {
          id,
          type: "text",
          x: 80,
          y: 80,
          w: 260,
          h: 120,
          z: maxZ + 1,
          text: "Жаңа мәтін",
        },
      ],
      activeId: id,
    }));
  },

  addSticker: async (emoji = "🔥") => {
    const maxZ = Math.max(0, ...get().objects.map((o) => o.z ?? 0));
    const id = nextId();
    set((s) => ({
      objects: [
        ...s.objects,
        {
          id,
          type: "sticker",
          x: 120,
          y: 120,
          w: 120,
          h: 120,
          z: maxZ + 1,
          sticker: emoji,
        },
      ],
      activeId: id,
    }));
  },

  addCheckbox: async () => {
    const maxZ = Math.max(0, ...get().objects.map((o) => o.z ?? 0));
    const id = nextId();
    set((s) => ({
      objects: [
        ...s.objects,
        {
          id,
          type: "checkbox",
          x: 100,
          y: 220,
          w: 240,
          h: 60,
          z: maxZ + 1,
          checked: false,
          label: "Жауап",
        },
      ],
      activeId: id,
    }));
  },

  deleteActive: async () => {
    const id = get().activeId;
    if (!id) return;
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      activeId: undefined,
    }));
  },
}));
