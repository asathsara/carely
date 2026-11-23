"use client";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { DoctorFinder } from "@/components/patient/doctor-finder";
import { AppointmentBooking } from "@/components/patient/appointment-booking";
import type { PatientDoctorOption, PatientVisitReason } from "@/lib/schemas/booking";

export function BookingBrowser({ reasons }: { reasons: PatientVisitReason[] }) {
  const [doctor, setDoctor] = useState<PatientDoctorOption | null>(null);
  const [reasonId, setReasonId] = useState("");
  const [doctors, setDoctors] = useState<PatientDoctorOption[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const booking = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!reasonId) return;
    const controller = new AbortController();
    async function loadDoctors() {
      setLoading(true);
      setDoctor(null);
      try {
        const response = await fetch(`/api/patient/doctor-finder?reasonId=${encodeURIComponent(reasonId)}`, { cache: "no-store", signal: controller.signal });
        const data: { doctors?: PatientDoctorOption[]; message?: string; error?: string } = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to find doctors.");
        setDoctors(data.doctors ?? []);
        setMessage(data.message ?? "");
      } catch (error) {
        if (!controller.signal.aborted) {
          setDoctors([]);
          setMessage(error instanceof Error ? error.message : "Unable to find doctors.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadDoctors();
    return () => controller.abort();
  }, [reasonId]);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <Card className="min-w-0 p-5 sm:p-6">
        <label className="mb-5 block text-sm font-semibold" htmlFor="visit-reason">
          Reason for visit
          <select
            id="visit-reason"
            className="border-input bg-background mt-2 flex h-11 w-full rounded-md border px-3 text-sm"
            value={reasonId}
            onChange={(event) => {
              const nextReasonId = event.target.value;
              setReasonId(nextReasonId);
              setDoctor(null);
              setDoctors([]);
              setMessage("");
            }}
          >
            <option value="">Choose a reason</option>
            {reasons.map((reason) => (
              <option key={reason.id} value={reason.id}>{reason.name} — {reason.specialtyName}</option>
            ))}
          </select>
        </label>
        {loading && <p role="status" className="text-muted-foreground mb-4 text-sm">Finding doctors...</p>}
        {message && <p role="status" className="text-muted-foreground mb-4 text-sm">{message}</p>}
        <DoctorFinder
          doctors={doctors}
          selectedId={doctor?.id}
          onSelect={(selected) => {
            setDoctor(selected);
            requestAnimationFrame(() =>
              booking.current?.scrollIntoView({ behavior: "smooth", block: "start" })
            );
          }}
        />
      </Card>
      <Card ref={booking} className="min-w-0 scroll-mt-5 p-5 sm:p-6">
        {doctor && reasonId ? (
          <AppointmentBooking key={`${doctor.id}-${reasonId}`} doctor={doctor} visitReasonId={reasonId} />
        ) : (
          <>
            <h2 className="font-semibold">Book appointment</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Choose a doctor to see available clinic dates.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
