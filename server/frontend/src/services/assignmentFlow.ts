import api from "../api/axios";

type StudentAssignment = {
  id: number;
  lesson: number;
};

export async function resolveNextAssignmentPath(currentAssignmentId?: number | null): Promise<string> {
  if (!currentAssignmentId) return "/student/dashboard";
  try {
    const { data } = await api.get<StudentAssignment[]>("/lessons/assignments/mine/?include_locked=1");
    const list = Array.isArray(data) ? data : [];
    const current = list.find((a) => a.id === currentAssignmentId);
    if (!current) return "/student/dashboard";

    const sameLesson = list
      .filter((a) => a.lesson === current.lesson)
      .sort((a, b) => a.id - b.id);
    const idxInLesson = sameLesson.findIndex((a) => a.id === currentAssignmentId);
    if (idxInLesson >= 0 && idxInLesson < sameLesson.length - 1) {
      return `/student/assignments/${sameLesson[idxInLesson + 1].id}`;
    }

    const ordered = [...list].sort((a, b) => a.id - b.id);
    const idx = ordered.findIndex((a) => a.id === currentAssignmentId);
    if (idx >= 0 && idx < ordered.length - 1) {
      return `/student/assignments/${ordered[idx + 1].id}`;
    }
    return "/student/dashboard";
  } catch {
    return "/student/dashboard";
  }
}
