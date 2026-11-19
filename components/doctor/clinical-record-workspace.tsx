"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useVisiblePolling } from "@/lib/hooks/use-visible-polling";
import type { DoctorConsultationQueueResponse } from "@/lib/schemas/consultation";
import type { ClinicalNotesResponse } from "@/lib/schemas/clinical-note";
import { PrescriptionForm } from "./prescription-form";

export function ClinicalRecordWorkspace() {
  const { data } =
    useVisiblePolling<DoctorConsultationQueueResponse>("/api/doctor/queue");
  const active = data?.entries.filter((entry) => entry.status === "with_doctor") ?? [];
  const [encounterId, setEncounterId] = useState("");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState<ClinicalNotesResponse["notes"]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const selectedEncounterId = encounterId || active[0]?.encounterId || "";
  useEffect(() => {
    if (!selectedEncounterId) return;
    void fetch(`/api/encounters/${encodeURIComponent(selectedEncounterId)}/notes`)
      .then(async (response) => {
        const result = (await response.json()) as ClinicalNotesResponse & {
          error?: string;
        };
        if (!response.ok) throw new Error(result.error);
        setNotes(result.notes);
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "Unable to load notes.")
      );
  }, [selectedEncounterId]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEncounterId) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/encounters/${encodeURIComponent(selectedEncounterId)}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save note.");
      setNotes((previous) => [...previous, result.note]);
      setContent("");
      setMessage("Clinical note saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save note.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border p-5">
        <label className="mb-2 block text-sm font-medium" htmlFor="encounter">
          Active consultation
        </label>
        <select
          id="encounter"
          className="w-full rounded-md border p-3"
          value={selectedEncounterId}
          onChange={(event) => setEncounterId(event.target.value)}
        >
          <option value="">Select an active consultation</option>
          {active.map((entry) => (
            <option key={entry.encounterId} value={entry.encounterId}>
              #{entry.appointmentNo} · {entry.patient.fullName}
            </option>
          ))}
        </select>
        {!active.length && (
          <p className="text-muted-foreground mt-3 text-sm">
            Open a consultation from your queue before recording notes.
          </p>
        )}
      </section>
      <form onSubmit={save} className="rounded-xl border p-5">
        <label className="mb-2 block text-sm font-medium" htmlFor="note-content">
          Clinical note
        </label>
        <textarea
          id="note-content"
          required
          maxLength={5000}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="w-full rounded-md border p-3"
          rows={7}
        />
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" disabled={!selectedEncounterId || pending}>
            {pending ? "Saving…" : "Save clinical note"}
          </Button>
          {message && (
            <span role="status" className="text-sm">
              {message}
            </span>
          )}
        </div>
      </form>
      <section className="rounded-xl border p-5">
        <h2 className="mb-4 font-semibold">Saved notes</h2>
        {notes.length ? (
          <div className="space-y-3">
            {notes.map((note) => (
              <article key={note.id} className="bg-muted rounded-md p-3">
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                <p className="text-muted-foreground mt-2 text-xs">
                  {new Date(note.createdAt).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No notes recorded for this consultation.
          </p>
        )}
      </section>
      {active.some((entry) => entry.encounterId === selectedEncounterId) && (
        <PrescriptionForm key={selectedEncounterId} encounterId={selectedEncounterId} />
      )}
    </div>
  );
}
