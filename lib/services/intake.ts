import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointment } from "@/lib/db/schema/appointment";
import { user } from "@/lib/db/schema/auth";
import { doctor } from "@/lib/db/schema/doctor";
import { encounter } from "@/lib/db/schema/encounter";
import { patient } from "@/lib/db/schema/patient";
import { queueEntry } from "@/lib/db/schema/queue-entry";
import { colomboNow } from "@/lib/clinic-time";
import type { NurseQueueEntry } from "@/lib/schemas/intake";
import { assertActiveActor, type Actor } from "./access-policy";
import { ServiceError } from "./service-error";

export async function getNurseQueue(actor: Actor): Promise<NurseQueueEntry[]> {
  if (actor.role !== "nurse") {
    throw new ServiceError("Only nurses can access the intake queue.", 403, "FORBIDDEN");
  }
  await assertActiveActor(actor);

  // The nurse can see the current waiting intake context, not clinical history.
  const rows = await db
    .select({
      id: queueEntry.id,
      encounterId: encounter.id,
      checkedInAt: queueEntry.checkedInAt,
      appointmentId: appointment.id,
      appointmentNo: appointment.appointmentNo,
      doctorId: doctor.id,
      doctorName: user.name,
      patientId: patient.id,
      patientNo: patient.patientNo,
      patientName: patient.fullName,
    })
    .from(queueEntry)
    .innerJoin(appointment, eq(queueEntry.appointmentId, appointment.id))
    .innerJoin(encounter, eq(encounter.appointmentId, appointment.id))
    .innerJoin(doctor, eq(appointment.doctorId, doctor.id))
    .innerJoin(user, eq(doctor.userId, user.id))
    .innerJoin(patient, eq(appointment.patientId, patient.id))
    .where(
      and(
        eq(appointment.appointmentDate, colomboNow().date),
        eq(appointment.status, "booked"),
        eq(queueEntry.status, "waiting"),
        eq(encounter.status, "in_progress")
      )
    )
    .orderBy(asc(queueEntry.checkedInAt), asc(queueEntry.id));

  return rows.map((row) => ({
    id: row.id,
    encounterId: row.encounterId,
    status: "waiting",
    checkedInAt: row.checkedInAt.toISOString(),
    appointmentId: row.appointmentId,
    appointmentNo: row.appointmentNo,
    doctorId: row.doctorId,
    doctorName: row.doctorName,
    patient: { id: row.patientId, patientNo: row.patientNo, fullName: row.patientName },
  }));
}
