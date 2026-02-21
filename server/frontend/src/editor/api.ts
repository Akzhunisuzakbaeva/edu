export type ApiSlideObject = {
  id: number;
  slide: number;
  object_type: "text" | "image" | "drawing" | "shape" | "attachment" | "checkbox";
  data: any;
  position: any;
  z_index: number;
  rotation: number;
};

const authHeaders = () => {
  const token = localStorage.getItem("access");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function fetchObjects(slideId: number): Promise<ApiSlideObject[]> {
  const r = await fetch(`/api/slide/objects/?slide=${slideId}`, {
    headers: { ...authHeaders() },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createObject(payload: Partial<ApiSlideObject>) {
  const r = await fetch(`/api/slide/objects/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function patchObject(id: number, patch: any) {
  const r = await fetch(`/api/slide/objects/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
