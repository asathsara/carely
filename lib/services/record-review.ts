import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointment } from "@/lib/db/schema/appointment";
import { clinicalNote } from "@/lib/db/schema/clinical-note";
import { encounter } from "@/lib/db/schema/encounter";
import { preliminaryNote } from "@/lib/db/schema/preliminary-note";
import { prescription } from "@/lib/db/schema/prescription";
import { queueEntry } from "@/lib/db/schema/queue-entry";
import { vitals } from "@/lib/db/schema/vitals";
import {
  doctorPatientHistoryParamsSchema,
  doctorVisitParamsSchema,
  type DoctorVisitReview,
  type PatientHistory,
} from "@/lib/schemas/record-review";
import {
  assertActiveActor,
  canViewClinical,
  isTreatingDoctor,
  type Actor,
} from "./access-policy";
import { ServiceError } from "./service-error";

function assertDoctor(actor: Actor) {
  if (actor.role !== "doctor") throw new ServiceError("Forbidden.", 403, "FORBIDDEN");
}

export async function getDoctorVisit(input: {
  queueEntryId: string;
  actor: Actor;
}): Promise<DoctorVisitReview> {
  assertDoctor(input.actor);
  if (!doctorVisitParamsSchema.safeParse({ queueEntryId: input.queueEntryId }).success) {
    throw new ServiceError("Invalid queue entry identifier.", 400, "INVALID_ID");
  }
  await assertActiveActor(input.actor);
  const [reference] = await db
    .select({ encounterId: encounter.id, appointmentId: appointment.id })
    .from(queueEntry)
    .innerJoin(appointment, eq(queueEntry.appointmentId, appointment.id))
    .innerJoin(encounter, eq(encounter.appointmentId, appointment.id))
    .where(eq(queueEntry.id, input.queueEntryId))
    .limit(1);
  if (
    !reference ||
    !(await isTreatingDoctor(input.actor.userId, reference.appointmentId))
  ) {
    throw new ServiceError("Visit not found.", 404, "NOT_FOUND");
  }
  const [intake] = await db
    .select({ content: preliminaryNote.content, createdAt: preliminaryNote.createdAt })
    .from(preliminaryNote)
    .where(eq(preliminaryNote.encounterId, reference.encounterId))
    .orderBy(asc(preliminaryNote.createdAt))
    .limit(1);
  const [recordedVitals] = await db
    .select()
    .from(vitals)
    .where(eq(vitals.encounterId, reference.encounterId))
    .orderBy(asc(vitals.recordedAt))
    .limit(1);
  const notes = await db
    .select({
      id: clinicalNote.id,
      content: clinicalNote.content,
      createdAt: clinicalNote.createdAt,
    })
    .from(clinicalNote)
    .where(eq(clinicalNote.encounterId, reference.encounterId))
    .orderBy(asc(clinicalNote.createdAt), asc(clinicalNote.id));
  return {
    encounterId: reference.encounterId,
    queueEntryId: input.queueEntryId,
    intake: intake && {
      content: intake.content,
      createdAt: intake.createdAt.toISOString(),
    },
    vitals: recordedVitals
      ? {
          bpSystolic: recordedVitals.bpSystolic,
          bpDiastolic: recordedVitals.bpDiastolic,
          heartRate: recordedVitals.heartRate,
          respiratoryRate: recordedVitals.respiratoryRate,
          temperatureC: recordedVitals.temperatureC,
          spo2: recordedVitals.spo2,
          weightKg: recordedVitals.weightKg,
          heightCm: recordedVitals.heightCm,
          additional: recordedVitals.additional,
          recordedAt: recordedVitals.recordedAt.toISOString(),
        }
      : null,
    notes: notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() })),
  };
}

export async function getPatientHistory(input: {
  patientId: string;
  actor: Actor;
}): Promise<PatientHistory> {
  assertDoctor(input.actor);
  if (
    !doctorPatientHistoryParamsSchema.safeParse({ patientId: input.patientId }).success
  ) {
    throw new ServiceError("Invalid patient identifier.", 400, "INVALID_ID");
  }
  if (!(await canViewClinical(input.actor, input.patientId))) {
    throw new ServiceError("Patient history not found.", 404, "NOT_FOUND");
  }
  const visits = await db
    .select({
      id: encounter.id,
      startedAt: encounter.startedAt,
      endedAt: encounter.endedAt,
    })
    .from(encounter)
    .where(
      and(eq(encounter.patientId, input.patientId), eq(encounter.status, "completed"))
    )
    .orderBy(desc(encounter.startedAt), desc(encounter.id));
  const encounters = await Promise.all(
    visits.map(async (visit) => {
      const [notes, prescriptions] = await Promise.all([
        db
          .select({
            id: clinicalNote.id,
            content: clinicalNote.content,
            createdAt: clinicalNote.createdAt,
          })
          .from(clinicalNote)
          .where(eq(clinicalNote.encounterId, visit.id))
          .orderBy(asc(clinicalNote.createdAt), asc(clinicalNote.id)),
        db
          .select({
            id: prescription.id,
            createdAt: prescription.createdAt,
            status: prescription.status,
          })
          .from(prescription)
          .where(eq(prescription.encounterId, visit.id))
          .orderBy(asc(prescription.createdAt), asc(prescription.id)),
      ]);
      return {
        id: visit.id,
        startedAt: visit.startedAt.toISOString(),
        endedAt: visit.endedAt?.toISOString() ?? null,
        notes: notes.map((note) => ({
          ...note,
          createdAt: note.createdAt.toISOString(),
        })),
        prescriptions: prescriptions.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        })),
      };
    })
  );
  return { patientId: input.patientId, encounters };
}
