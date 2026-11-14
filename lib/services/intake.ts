import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointment } from "@/lib/db/schema/appointment";
import { user } from "@/lib/db/schema/auth";
import { doctor } from "@/lib/db/schema/doctor";
import { encounter } from "@/lib/db/schema/encounter";
import { patient } from "@/lib/db/schema/patient";
import { queueEntry } from "@/lib/db/schema/queue-entry";
import { vitals } from "@/lib/db/schema/vitals";
import { preliminaryNote } from "@/lib/db/schema/preliminary-note";
import { auditLog } from "@/lib/db/schema/audit-log";
import { intakeActions } from "@/lib/audit/actions/intake";
import { colomboNow } from "@/lib/clinic-time";
import {
  intakeEncounterParamsSchema,
  recordIntakeSchema,
  type NurseQueueEntry,
  type RecordedIntake,
  type RecordIntakeInput,
  type NurseIntakeReceipt,
} from "@/lib/schemas/intake";
import { assertActiveActor, type Actor } from "./access-policy";
import { assertEncounterWritable } from "./encounter";
import { transitionQueueEntry } from "./queue";
import { recordAudit } from "./audit";
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

// Own-action confirmation only: no post-handoff clinical or patient data is returned.
export async function getNurseIntakeReceipt(
  encounterId: string,
  actor: Actor
): Promise<NurseIntakeReceipt> {
  if (actor.role !== "nurse") throw new ServiceError("Forbidden.", 403, "FORBIDDEN");
  if (!intakeEncounterParamsSchema.safeParse({ id: encounterId }).success) {
    throw new ServiceError("Invalid encounter identifier.", 400, "INVALID_ID");
  }
  await assertActiveActor(actor);
  const [event] = await db
    .select({ recordedAt: auditLog.createdAt })
    .from(encounter)
    .innerJoin(appointment, eq(encounter.appointmentId, appointment.id))
    .innerJoin(
      auditLog,
      and(eq(auditLog.entityId, encounterId), eq(auditLog.entityType, "encounter"))
    )
    .where(
      and(
        eq(encounter.id, encounterId),
        eq(appointment.appointmentDate, colomboNow().date),
        eq(auditLog.userId, actor.userId),
        eq(auditLog.action, intakeActions.recorded)
      )
    )
    .limit(1);
  if (!event)
    throw new ServiceError("Saved confirmation is unavailable.", 404, "NOT_FOUND");
  return { encounterId, recordedAt: event.recordedAt.toISOString() };
}

export async function recordIntake(input: {
  encounterId: string;
  intake: RecordIntakeInput;
  actor: Actor;
}): Promise<RecordedIntake> {
  if (input.actor.role !== "nurse") {
    throw new ServiceError("Only nurses can record intake.", 403, "FORBIDDEN");
  }
  if (!intakeEncounterParamsSchema.safeParse({ id: input.encounterId }).success) {
    throw new ServiceError("Invalid encounter identifier.", 400, "INVALID_ID");
  }
  const parsed = recordIntakeSchema.safeParse(input.intake);
  if (!parsed.success) {
    throw new ServiceError("Provide valid intake records.", 400, "INVALID_INTAKE");
  }
  const data = parsed.data;

  return db.transaction(async (tx) => {
    // Locks appointment -> encounter and checks today's booked, waiting visit.
    const visit = await assertEncounterWritable(input.encounterId, input.actor, tx);
    const [entry] = await tx
      .select({ id: queueEntry.id })
      .from(queueEntry)
      .where(eq(queueEntry.appointmentId, visit.appointmentId))
      .limit(1);
    if (!entry) {
      throw new ServiceError(
        "The visit is not awaiting intake.",
        409,
        "INVALID_WORKFLOW_STATE"
      );
    }

    const recordedAt = new Date();
    const decimal = (value: number | null | undefined) =>
      value == null ? null : value.toFixed(1);
    const [savedVitals] = await tx
      .insert(vitals)
      .values({
        ...data.vitals,
        encounterId: visit.id,
        recordedBy: input.actor.userId,
        recordedAt,
        temperatureC: decimal(data.vitals.temperatureC),
        weightKg: decimal(data.vitals.weightKg),
        heightCm: decimal(data.vitals.heightCm),
      })
      .returning({ id: vitals.id });
    const [savedNote] = await tx
      .insert(preliminaryNote)
      .values({
        encounterId: visit.id,
        authorId: input.actor.userId,
        content: `Initial complaint:\n${data.complaint}\n\nPreliminary note:\n${data.preliminaryNote}`,
        createdAt: recordedAt,
      })
      .returning({ id: preliminaryNote.id });

    await transitionQueueEntry(
      { entryId: entry.id, from: "waiting", to: "intake_done", actor: input.actor },
      tx
    );
    await recordAudit(tx, {
      actorId: input.actor.userId,
      action: intakeActions.recorded,
      targetType: "encounter",
      targetId: visit.id,
    });

    return {
      encounterId: visit.id,
      queueEntryId: entry.id,
      status: "intake_done",
      vitalsId: savedVitals.id,
      preliminaryNoteId: savedNote.id,
      recordedAt: recordedAt.toISOString(),
    };
  });
}
