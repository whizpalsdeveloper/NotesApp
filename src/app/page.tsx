"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type Note } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogTrigger } from
"@/components/ui/alert-dialog";

function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listNotes({ q: q || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined });
      setNotes(data);
    } catch (e: any) {
      setError(e.message || "Failed to load notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { notes, setNotes, loading, error, refresh, q, setQ, dateFrom, setDateFrom, dateTo, setDateTo };
}

export default function NotesPage() {
  const { notes, setNotes, loading, error, refresh, q, setQ, dateFrom, setDateFrom, dateTo, setDateTo } = useNotes();

  // form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  const onAdd = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      setGlobalError(null);
      const created = await api.createNote({ title: title.trim(), content });
      if (files.length > 0) {
        const withImages = await api.uploadImages(created._id, files);
        setNotes((prev) => [withImages, ...prev]);
      } else {
      setNotes((prev) => [created, ...prev]);
      }
      setTitle("");
      setContent("");
      setFiles([]);
    } catch (e: any) {
      setGlobalError(e.message || "Failed to create note");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen container mx-auto max-w-4xl p-6 space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-[180px]">
          <h1 className="text-2xl font-bold">Notes App</h1>
          <p className="text-sm text-muted-foreground">FastAPI + MongoDB + Next.js</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">Search</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title or content" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <Button variant="secondary" onClick={refresh} disabled={loading}>Apply</Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add a new note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting} className="!px-[9px]" />

          <Textarea
            placeholder="Content (optional)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            disabled={submitting} />

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            disabled={submitting}
          />

        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={onAdd} disabled={!canSubmit || submitting}>
            {submitting ? "Adding..." : "Add Note"}
          </Button>
          {globalError ?
          <p className="text-sm text-red-600" role="alert">{globalError}</p> :
          null}
        </CardFooter>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Your notes</h2>
        {loading ?
        <div className="grid gap-3 sm:grid-cols-2">
            {[...Array(4)].map((_, i) =>
          <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
          )}
          </div> :
        error ?
        <div className="rounded-md border p-4 text-sm text-red-600" role="alert">
            {error}
          </div> :
        notes.length === 0 ?
        <p className="text-sm text-muted-foreground">No notes yet. Add your first one above.</p> :

        <div className="grid gap-3 sm:grid-cols-2">
            {notes.map((note) =>
          <NoteCard key={note._id} note={note} onUpdated={refresh} onLocalUpdate={(n) => {
            setNotes((prev) => prev.map((p) => p._id === n._id ? n : p));
          }} onLocalDelete={(id) => {
            setNotes((prev) => prev.filter((p) => p._id !== id));
          }} />
          )}
          </div>
        }
      </section>
    </div>);

}

function NoteCard({ note, onUpdated, onLocalUpdate, onLocalDelete




}: {note: Note;onUpdated: () => void;onLocalUpdate: (n: Note) => void;onLocalDelete: (id: string) => void;}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const updatedAt = new Date(note.updated_at).toLocaleString();

  const save = async () => {
    try {
      setSaving(true);
      setErr(null);
      const updated = await api.updateNote(note._id, { title, content });
      let finalNote = updated;
      if (newFiles.length > 0) {
        finalNote = await api.uploadImages(note._id, newFiles);
        setNewFiles([]);
      }
      onLocalUpdate(finalNote);
      setEditing(false);
    } catch (e: any) {
      setErr(e.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.deleteNote(note._id);
      onLocalDelete(note._id);
    } catch (e: any) {
      setErr(e.message || "Failed to delete");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          {editing ?
          <Input value={title} onChange={(e) => setTitle(e.target.value)} /> :

          <span>{note.title}</span>
          }
          <span className="text-xs font-normal text-muted-foreground">{updatedAt}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {editing ?
        <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} /> :

        <p className="whitespace-pre-wrap text-sm">{note.content || ""}</p>
        }
        {Array.isArray(note.images) && note.images.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {note.images.map((src) => (
              <div key={src} className="relative">
                <img
                  src={`${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"}${src.startsWith("/") ? src : `/${src}`}`}
                  alt="note image"
                  className="h-24 w-full object-cover rounded"
                />
                <Button
                  variant="destructive"
                  className="mt-1 w-full"
                  onClick={async () => {
                    try {
                      const n = await api.deleteImage(note._id, src);
                      onLocalUpdate(n);
                    } catch (e: any) {
                      setErr(e.message || "Failed to delete image");
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {editing ? (
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => setNewFiles(Array.from(e.target.files || []))}
          />
        ) : null}
        {err ? <p className="text-sm text-red-600" role="alert">{err}</p> : null}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        {editing ?
        <>
            <Button variant="secondary" onClick={() => {setEditing(false);setTitle(note.title);setContent(note.content);}} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving || title.trim().length === 0}>{saving ? "Saving..." : "Save"}</Button>
          </> :

        <>
            <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the note titled "{note.title}".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      </CardFooter>
    </Card>);

}