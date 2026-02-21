// server/frontend/src/api/auth.ts
import api from "./axios";

export type Role = "teacher" | "student";
export type LoginResponse = {
  access: string;
  refresh: string;
  role: Role;      // ✅ қосылды
  user_id?: number;
  email?: string;
};

export async function login(username: string, password: string) {
  const { data } = await api.post<LoginResponse>("/auth/login/", { username, password });

  localStorage.setItem("access", data.access);
  localStorage.setItem("refresh", data.refresh);
  localStorage.setItem("role", data.role); // ✅ МІНЕ ОСЫ ЖЕТІСПЕЙ ТҰР

  if (data.user_id) localStorage.setItem("user_id", String(data.user_id));
  if (data.email) localStorage.setItem("email", data.email);

  return data;
}

export async function registerTeacher(payload: {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  school?: string;
  subject?: string;
}) {
  const { data } = await api.post("/auth/register/", {
    ...payload,
    role: "teacher",
  });
  return data;
}

export async function createStudent(payload: {
  username: string;
  email?: string;
  password: string;
  full_name?: string;
}) {
  const { data } = await api.post("/auth/create-student/", payload);
  return data;
}

export function logout() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("role");
  localStorage.removeItem("user_id");
  localStorage.removeItem("email");
}
