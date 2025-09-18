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

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listNotes();
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

  return { notes, setNotes, loading, error, refresh };
}

export default function NotesPage() {
  const { notes, setNotes, loading, error, refresh } = useNotes();

  // form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  const onAdd = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      setGlobalError(null);
      const created = await api.createNote({ title: title.trim(), content });
      setNotes((prev) => [created, ...prev]);
      setTitle("");
      setContent("");
    } catch (e: any) {
      setGlobalError(e.message || "Failed to create note");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen container mx-auto max-w-4xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notes App</h1>
          <p className="text-sm text-muted-foreground">FastAPI + MongoDB + Next.js</p>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={loading}>
          Refresh
        </Button>
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
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const updatedAt = new Date(note.updated_at).toLocaleString();

  const save = async () => {
    try {
      setSaving(true);
      setErr(null);
      const updated = await api.updateNote(note._id, { title, content });
      onLocalUpdate(updated);
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