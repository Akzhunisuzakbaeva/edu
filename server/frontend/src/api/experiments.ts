import api from "./axios";

export async function listExperiments(params?: { lesson?: number }) {
  const { data } = await api.get("/lessons/experiments/", { params });
  return data;
}

export async function createExperiment(payload: {
  lesson?: number | null;
  title: string;
  focus_topic?: string;
  hypothesis?: string;
  pre_start?: string;
  pre_end?: string;
  post_start?: string;
  post_end?: string;
  notes?: string;
  is_active?: boolean;
}) {
  const { data } = await api.post("/lessons/experiments/", payload);
  return data;
}

export async function createDatabaseSampleExperiment(payload?: {
  lesson_id?: number;
  title?: string;
  focus_topic?: string;
  hypothesis?: string;
  notes?: string;
}) {
  const { data } = await api.post("/lessons/experiments/sample-db/", payload || {});
  return data;
}

export async function assignExperimentStudents(
  experimentId: number,
  payload: { group: "control" | "experimental"; students: number[] }
) {
  const { data } = await api.post(`/lessons/experiments/${experimentId}/assign/`, payload);
  return data;
}

export async function autoSplitExperiment(
  experimentId: number,
  payload?: { reset_existing?: boolean; students?: number[] }
) {
  const { data } = await api.post(`/lessons/experiments/${experimentId}/auto-split/`, payload || {});
  return data;
}

export async function getExperimentReport(experimentId: number) {
  const { data } = await api.get(`/lessons/experiments/${experimentId}/report/`);
  return data;
}

export async function downloadExperimentCsv(experimentId: number) {
  const response = await api.get(`/lessons/experiments/${experimentId}/export-csv/`, {
    responseType: "blob",
  });
  return response.data as Blob;
}

export async function updateExperimentParticipant(
  participantId: number,
  payload: {
    group?: "control" | "experimental";
    pre_score?: number | null;
    post_score?: number | null;
    pre_motivation?: number | null;
    post_motivation?: number | null;
    notes?: string;
  }
) {
  const { data } = await api.patch(`/lessons/experiment-participants/${participantId}/`, payload);
  return data;
}
