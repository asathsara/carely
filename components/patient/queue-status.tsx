"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { FactCard } from "@/components/patient/patient-shared";
import { formatPatientDate } from "@/lib/patient-appointments";
import type { PatientAppointmentView } from "@/lib/schemas/booking";
import { useVisiblePolling } from "@/lib/hooks/use-visible-polling";

export function QueueStatus({ appointment }: { appointment?: PatientAppointmentView }) {
  const { data, error, loading, refresh } = useVisiblePolling<{
    entry: { status: string; position: number | null } | null;
  }>("/api/patient/queue");
  return (
    <div className="space-y-5">
      <h2 className="font-semibold">
        {appointment ? "Your next visit" : "No upcoming appointments"}
      </h2>
      {appointment && (
        <>
          <p className="font-semibold">{appointment.doctorName}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FactCard label="Date" value={formatPatientDate(appointment.date)} />
            <FactCard
              label="Appointment number"
              value={`#${appointment.appointmentNo}`}
            />
          </div>
        </>
      )}
      {data?.entry ? (
        <div className="bg-carely-surface rounded-xl p-4 text-sm">
          <p className="font-semibold">
            Queue status: {data.entry.status.replaceAll("_", " ")}
          </p>
          <p className="mt-1">
            {data.entry.position === null
              ? "This visit is complete."
              : `Your current position: ${data.entry.position}`}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {loading
            ? "Checking your queue status…"
            : "Check in at reception when you arrive."}
        </p>
      )}
      {error && (
        <p role="status" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="button" variant="outline" onClick={() => void refresh()}>
        Refresh now
      </Button>
      <Link
        href={appointment ? "/patient/appointments" : "/patient/book"}
        className={buttonVariants({ variant: "outline" })}
      >
        {appointment ? "View appointments" : "Find a doctor"}
      </Link>
    </div>
  );
}
