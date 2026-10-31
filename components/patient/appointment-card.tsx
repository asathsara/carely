"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FactCard, StatusBadge } from "@/components/patient/patient-shared";
import {
  appointmentStatus,
  formatPatientDate,
  formatSession,
} from "@/lib/patient-appointments";
import type { PatientAppointmentView } from "@/lib/schemas/booking";

export function AppointmentCard({
  appointment,
}: {
  appointment: PatientAppointmentView;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function cancel() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/appointments/${encodeURIComponent(appointment.id)}/cancel`,
        { method: "POST" }
      );
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error ?? "Unable to cancel appointment.");
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to cancel. Please try again."
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return (
    <article className="space-y-3 rounded-xl border p-4">
      <StatusBadge tone={appointment.isUpcoming ? "green" : "blue"}>
        {appointmentStatus(appointment.status)}
      </StatusBadge>
      <h3 className="font-semibold">{appointment.doctorName}</h3>
      <p className="text-muted-foreground text-sm">
        {appointment.specialtyName ?? "General clinic"}
      </p>
      <p className="text-sm font-medium">
        {formatPatientDate(appointment.date)} · Appointment #{appointment.appointmentNo}
      </p>
      <p className="text-muted-foreground text-sm">
        Clinic hours: {formatSession(appointment.startTime, appointment.endTime)}
      </p>
      <p className="text-muted-foreground text-xs break-all">
        Reference {appointment.id}
      </p>
      {appointment.feeAmount && (
        <p className="text-sm">Consultation fee: LKR {appointment.feeAmount}</p>
      )}
      {appointment.canCancel && (
        <Dialog
          open={open}
          onOpenChange={(value) => {
            if (!pending) setOpen(value);
          }}
        >
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            Cancel appointment
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel appointment?</DialogTitle>
              <DialogDescription>
                Cancel appointment #{appointment.appointmentNo} with{" "}
                {appointment.doctorName} on {formatPatientDate(appointment.date)}?
              </DialogDescription>
            </DialogHeader>
            <FactCard label="Reference" value={appointment.id} />
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                Keep appointment
              </Button>
              <Button variant="destructive" disabled={pending} onClick={cancel}>
                {pending ? "Cancelling..." : "Cancel appointment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </article>
  );
}
