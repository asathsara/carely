"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Panel, StatCards } from "@/components/workspace/workspace-ui";
import { useVisiblePolling } from "@/lib/hooks/use-visible-polling";

type Doctor = { id: string; name: string; specialtyName?: string | null };
type QueueEntry = {
  id: string;
  status: string;
  appointmentNo: number;
  checkedInAt: string;
  patient: { patientNo: string; fullName: string };
};
const colomboDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export function QueueManagement() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const date = useMemo(colomboDate, []);
  useEffect(() => {
    void fetch("/api/reception/doctors", { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : Promise.reject()))
      .then(({ doctors: records }) => {
        setDoctors(records);
        setDoctorId((current) => current || records[0]?.id || "");
      })
      .catch(() => setDoctors([]));
  }, []);
  const url = doctorId
    ? `/api/queue?doctorId=${encodeURIComponent(doctorId)}&date=${date}`
    : "/api/queue?doctorId=invalid&date=invalid";
  const { data, error, loading, refresh } = useVisiblePolling<{ entries: QueueEntry[] }>(
    url
  );
  const entries = data?.entries ?? [];
  return (
    <>
      <StatCards
        metrics={[
          { label: "Checked in", value: String(entries.length), tone: "blue" },
          {
            label: "Waiting",
            value: String(entries.filter((entry) => entry.status === "waiting").length),
            tone: "sky",
          },
        ]}
      />
      <Panel title="Live queue">
        <div className="mb-5 max-w-md">
          <label htmlFor="queue-doctor" className="mb-2 block text-xs font-semibold">
            Doctor
          </label>
          <Select
            value={doctorId}
            items={doctors.map((doctor) => ({ value: doctor.id, label: doctor.name }))}
            onValueChange={(value) => value && setDoctorId(value)}
          >
            <SelectTrigger id="queue-doctor">
              <SelectValue placeholder="Select a doctor" />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((doctor) => (
                <SelectItem key={doctor.id} value={doctor.id}>
                  {doctor.name}
                  {doctor.specialtyName ? ` · ${doctor.specialtyName}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error && (
          <p role="status" className="text-destructive text-sm">
            Unable to load this queue.
          </p>
        )}
        {loading && <p className="text-muted-foreground text-sm">Loading queue…</p>}
        <div className="space-y-3">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div>
                <p className="font-semibold">
                  #{entry.appointmentNo} · {entry.patient.fullName}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {entry.patient.patientNo} · checked in{" "}
                  {new Date(entry.checkedInAt).toLocaleTimeString()}
                </p>
              </div>
              <Badge>{entry.status.replaceAll("_", " ")}</Badge>
            </article>
          ))}
          {!loading && !entries.length && (
            <p className="text-muted-foreground text-sm">
              No checked-in patients for this doctor today.
            </p>
          )}
        </div>
        <button
          type="button"
          className="text-primary mt-4 text-sm font-semibold"
          onClick={() => void refresh()}
        >
          Refresh now
        </button>
      </Panel>
    </>
  );
}
