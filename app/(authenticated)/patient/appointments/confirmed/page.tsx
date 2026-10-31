import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FactCard, StatusBadge } from "@/components/patient/patient-shared";
import { PrintPrescriptionButton } from "@/components/workspace/print-prescription-button";
import { PageTitle } from "@/components/workspace/workspace-ui";
import { requireRole } from "@/lib/auth-guard";
import {
  appointmentStatus,
  formatPatientDate,
  formatSession,
} from "@/lib/patient-appointments";
import { getPatientAppointments } from "@/lib/services/patient-booking";
import { cancelAppointmentSchema } from "@/lib/schemas/booking";

export default async function AppointmentConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const session = await requireRole("patient");
  const { id } = await searchParams;
  if (
    typeof id !== "string" ||
    !cancelAppointmentSchema.safeParse({ appointmentId: id }).success
  )
    notFound();
  const [appointment] = await getPatientAppointments(session.user.id, id);
  if (!appointment) notFound();
  return (
    <>
      <PageTitle
        eyebrow="Appointments"
        title={
          appointment.status === "booked"
            ? "Appointment confirmed"
            : "Appointment details"
        }
        description="Keep your reference and appointment number for reception."
      />
      <Card className="space-y-5 p-5 sm:p-8">
        <StatusBadge tone={appointment.status === "booked" ? "green" : "blue"}>
          {appointmentStatus(appointment.status)}
        </StatusBadge>
        <h2 className="text-2xl font-bold">{appointment.doctorName}</h2>
        <p className="text-muted-foreground">
          {appointment.specialtyName ?? "General clinic"}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FactCard label="Appointment number" value={`#${appointment.appointmentNo}`} />
          <FactCard label="Date" value={formatPatientDate(appointment.date)} />
          <FactCard
            label="Clinic hours"
            value={formatSession(appointment.startTime, appointment.endTime)}
          />
          <FactCard label="Reference" value={appointment.id} />
        </div>
        <p className="text-muted-foreground text-sm">
          Your appointment number gives your order within the session. Check in at
          reception when you arrive; consultation times can vary.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link className={buttonVariants({})} href="/patient/appointments">
            View appointments
          </Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/patient">
            Back to dashboard
          </Link>
          <PrintPrescriptionButton label="Print confirmation" variant="outline" />
        </div>
      </Card>
    </>
  );
}
