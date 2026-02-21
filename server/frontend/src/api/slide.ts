import api from "./axios";

// slides
export async function getSlides(params?: { lesson?: number }) {
  const { data } = await api.get("slide/slides/", { params });
  return data;
}

// slide objects
export async function getSlideObjects(params?: { slide?: number }) {
  const { data } = await api.get("slide/objects/", { params });
  return data;
}

export async function createSlideObject(payload: any) {
  const { data } = await api.post("slide/objects/", payload);
  return data;
}

export async function patchSlideObject(id: number, payload: any) {
  const { data } = await api.patch(`slide/objects/${id}/`, payload);
  return data;
}

export async function deleteSlideObject(id: number) {
  await api.delete(`slide/objects/${id}/`);
}

// submissions stats
export async function getSubmissionStats(params: { template?: number; slide?: number; from?: string; to?: string }) {
  const { data } = await api.get("slide/submissions/stats/", { params });
  return data;
}

export async function getSubmissionMistakes(params: { template?: number; slide?: number; from?: string; to?: string }) {
  const { data } = await api.get("slide/submissions/mistakes/", { params });
  return data;
}

// submissions
export async function createSubmission(payload: {
  template?: number;
  slide?: number;
  data: any;
  duration_seconds?: number;
}) {
  const { data } = await api.post("slide/submissions/", payload);
  return data;
}
