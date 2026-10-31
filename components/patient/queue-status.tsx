import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { FactCard } from "@/components/patient/patient-shared";
import { formatPatientDate } from "@/lib/patient-appointments";
import type { PatientAppointmentView } from "@/lib/schemas/booking";

export function QueueStatus({ appointment }: { appointment?: PatientAppointmentView }) {
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
      <p className="text-muted-foreground text-sm">
        Check in at reception when you arrive. Contact reception for your current queue
        position and check-in status.
      </p>
      <Link
        href={appointment ? "/patient/appointments" : "/patient/book"}
        className={buttonVariants({ variant: "outline" })}
      >
        {appointment ? "View appointments" : "Find a doctor"}
      </Link>
    </div>
  );
}
