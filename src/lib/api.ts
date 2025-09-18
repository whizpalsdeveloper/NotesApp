export type Note = {
    _id: string;
    title: string;
    content: string;
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
    listNotes: () => http<Note[]>("/notes"),
    getNote: (id: string) => http<Note>(`/notes/${id}`),
    createNote: (data: { title: string; content: string }) =>
      http<Note>("/notes", { method: "POST", body: JSON.stringify(data) }),
    updateNote: (id: string, data: Partial<Pick<Note, "title" | "content">>) =>
      http<Note>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteNote: (id: string) =>
      fetch(`${API_BASE}/notes/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error(`Delete failed with ${r.status}`);
      }),
  };