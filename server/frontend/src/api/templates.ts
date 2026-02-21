import apiClient from "./axios";

// Типтер
export type TemplateType =
  | "quiz"
  | "matching"
  | "flashcards"
  | "poll"
  | "crossword"
  | "sorting"
  | "grouping"
  | string;

export interface SlideTemplate {
  id: number;
  title: string;
  template_type?: TemplateType;
  data?: any;
  created_at?: string;
  author?: number;
  [key: string]: any;
}

export interface ApplyTemplateResponse {
  template_id: number;
  created_slides: { id: number; title?: string }[];
  message?: string;
  slides?: number[]; // backend older response compatibility
}

const api = apiClient;
const BASE = "slide/templates";

export async function getTemplates(): Promise<SlideTemplate[]> {
  const { data } = await api.get(`${BASE}/`);
  return data;
}

export async function createPresetTemplate(payload: {
  type?: TemplateType;
  template_type?: TemplateType;
  title?: string;
  [k: string]: any;
}): Promise<SlideTemplate> {
  const template_type = payload.template_type ?? payload.type;
  const { data } = await api.post(`${BASE}/preset/`, {
    ...payload,
    template_type,
  });
  return data;
}

export async function createTemplate(payload: {
  title: string;
  template_type: TemplateType;
  data: any;
}): Promise<SlideTemplate> {
  const { data } = await api.post(`${BASE}/`, payload);
  return data;
}

export async function applyTemplate(
  id: number,
  payload: Record<string, any> = {}
): Promise<ApplyTemplateResponse> {
  const { data } = await api.post(`${BASE}/${id}/apply/`, payload);
  // Normalize legacy shape if backend returns {slides: []}
  if (!data.created_slides && Array.isArray(data.slides)) {
    data.created_slides = data.slides.map((sid: number) => ({
      id: sid,
      title: "",
    }));
    data.template_id = id;
  }
  return data;
}

// Compatibility exports for existing imports
export const listTemplates = getTemplates;
export const createTemplatePreset = createPresetTemplate;
export async function applyTemplateToLesson(templateId: number, lesson_id: number) {
  return applyTemplate(templateId, { lesson_id });
}

export interface ImportDocxQuizResponse {
  mode?: "separate" | "single_quiz";
  created_count: number;
  created: Array<{ id: number; title: string }>;
  questions_detected?: number;
  warnings?: string[];
}

export async function importQuizFromDocx(
  file: File,
  title: string,
  mode: "separate" | "single_quiz" = "separate"
): Promise<ImportDocxQuizResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title || "Word Quiz");
  form.append("mode", mode);
  const { data } = await api.post(`${BASE}/import-docx-quiz/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
