export type Note = {
    _id: string;
    title: string;
    content: string;
    images?: string[];
    created_at: string;
    updated_at: string;
  };
  
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
  
  async function http<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Request failed with ${res.status}`);
    }
    return res.json() as Promise<T>;
  }
  
  export const api = {
    listNotes: (params?: { q?: string; date_from?: string; date_to?: string }) => {
      const qs = params
        ? "?" + new URLSearchParams(
            Object.entries(params).reduce((acc, [k, v]) => {
              if (v) acc[k] = v as string;
              return acc;
            }, {} as Record<string, string>)
          ).toString()
        : "";
      return http<Note[]>(`/notes${qs}`);
    },
    getNote: (id: string) => http<Note>(`/notes/${id}`),
    createNote: (data: { title: string; content: string; images?: string[] }) =>
      http<Note>("/notes", { method: "POST", body: JSON.stringify(data) }),
    updateNote: (id: string, data: Partial<Pick<Note, "title" | "content">>) =>
      http<Note>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteNote: (id: string) =>
      fetch(`${API_BASE}/notes/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error(`Delete failed with ${r.status}`);
      }),
    uploadImages: async (id: string, files: File[]) => {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const res = await fetch(`${API_BASE}/notes/${id}/images`, { method: "POST", body: fd });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Upload failed with ${res.status}`);
      }
      return (await res.json()) as Note;
    },
    deleteImage: async (id: string, url: string) => {
      const res = await fetch(`${API_BASE}/notes/${id}/images?url=${encodeURIComponent(url)}`, { method: "DELETE" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Delete image failed with ${res.status}`);
      }
      return (await res.json()) as Note;
    },
  };