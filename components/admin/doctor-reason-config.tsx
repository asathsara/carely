"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/workspace/workspace-ui";

type Specialty = { id: string; name: string };
type VisitReason = { id: string; name: string; specialtyId: string; specialtyName: string };

export function DoctorReasonConfig() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [reasons, setReasons] = useState<VisitReason[]>([]);
  const [name, setName] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [specialtyResponse, reasonResponse] = await Promise.all([fetch("/api/admin/specialties", { cache: "no-store" }), fetch("/api/admin/visit-reasons", { cache: "no-store" })]);
    const specialtyData: { specialties?: Specialty[]; error?: string } = await specialtyResponse.json();
    const reasonData: { reasons?: VisitReason[]; error?: string } = await reasonResponse.json();
    if (!specialtyResponse.ok || !reasonResponse.ok) throw new Error(specialtyData.error ?? reasonData.error ?? "Unable to load configuration.");
    setSpecialties(specialtyData.specialties ?? []);
    setReasons(reasonData.reasons ?? []);
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load().catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Unable to load configuration.")
      );
    });
  }, []);

  async function save(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data: { error?: string } = response.status === 204 ? {} : await response.json();
    if (!response.ok) throw new Error(data.error ?? "Unable to save visit reason.");
    await load();
  }

  async function addReason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    try { await save("/api/admin/visit-reasons", "POST", { name, specialtyId }); setName(""); setSpecialtyId(""); setMessage("Visit reason created."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save visit reason."); }
  }

  async function updateReason(reason: VisitReason, changes: Partial<Pick<VisitReason, "name" | "specialtyId">>) {
    setError("");
    try { await save(`/api/admin/visit-reasons/${reason.id}`, "PATCH", { name: changes.name ?? reason.name, specialtyId: changes.specialtyId ?? reason.specialtyId }); setMessage("Visit reason updated."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save visit reason."); }
  }

  return <Panel title="Visit reasons" className="min-w-0">
    <p className="text-muted-foreground mb-5 text-sm">Each reason maps patients to active doctors in one specialty.</p>
    <div className="space-y-3">
      {reasons.map((reason) => <div key={reason.id} className="bg-carely-surface grid gap-3 rounded-xl p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <Input id={`reason-${reason.id}`} label="Reason" showLabel value={reason.name} onChange={(event) => setReasons((current) => current.map((item) => item.id === reason.id ? { ...item, name: event.target.value } : item))} onBlur={() => void updateReason(reason, { name: reasons.find((item) => item.id === reason.id)?.name })} />
        <label className="text-sm font-semibold" htmlFor={`reason-specialty-${reason.id}`}>Specialty
          <select id={`reason-specialty-${reason.id}`} className="border-input bg-background mt-2 flex h-11 w-full rounded-md border px-3 text-sm" value={reason.specialtyId} onChange={(event) => void updateReason(reason, { specialtyId: event.target.value })}>{specialties.map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}</select>
        </label>
        <Button type="button" variant="outline" onClick={() => void save(`/api/admin/visit-reasons/${reason.id}`, "DELETE").then(() => setMessage("Visit reason deleted.")).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to delete visit reason."))}>Delete</Button>
      </div>)}
      {!reasons.length && <p className="text-muted-foreground text-sm">No visit reasons have been configured.</p>}
    </div>
    <form onSubmit={addReason} className="mt-5 grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <Input id="new-visit-reason" label="New reason" showLabel required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
      <label className="text-sm font-semibold" htmlFor="new-reason-specialty">Specialty
        <select id="new-reason-specialty" required className="border-input bg-background mt-2 flex h-11 w-full rounded-md border px-3 text-sm" value={specialtyId} onChange={(event) => setSpecialtyId(event.target.value)}><option value="">Choose a specialty</option>{specialties.map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}</select>
      </label>
      <Button type="submit">Add reason</Button>
    </form>
    {error && <p role="alert" className="text-destructive mt-3 text-sm">{error}</p>}
    {message && <p role="status" className="text-primary mt-3 text-sm">{message}</p>}
  </Panel>;
}
