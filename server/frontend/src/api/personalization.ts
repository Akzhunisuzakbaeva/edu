import api from "./axios";

export type StudentProfileUpdate = {
  interest_focus?: string;
  preferred_formats?: string[];
  learning_goals?: string;
};

export async function getMyStudentProfile(refresh = false) {
  const { data } = await api.get("/auth/profile/", {
    params: refresh ? { refresh: 1 } : undefined,
  });
  return data;
}

export async function updateMyStudentProfile(payload: StudentProfileUpdate) {
  const { data } = await api.patch("/auth/profile/", payload);
  return data;
}

export async function getStudentProfileById(studentId: number) {
  const { data } = await api.get(`/auth/profile/${studentId}/`);
  return data;
}

export async function getStudentInsights(refresh = false) {
  const { data } = await api.get("/lessons/insights/student/", {
    params: refresh ? { refresh: 1 } : undefined,
  });
  return data;
}

export async function refreshStudentInsights(studentId?: number) {
  const { data } = await api.post("/lessons/insights/refresh/", studentId ? { student_id: studentId } : {});
  return data;
}

export async function getTeacherInsights(params?: { lesson?: number; student?: number }) {
  const { data } = await api.get("/lessons/insights/teacher/", { params });
  return data;
}
