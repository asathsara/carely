import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { patientActions } from "@/lib/audit/actions/patient";
import { user } from "@/lib/db/schema/auth";
import { patient, type Patient } from "@/lib/db/schema/patient";
import type {
  PatientProfileUpdate,
  ReceptionistPatientUpdate,
} from "@/lib/schemas/patient-update";
import { canViewPatientAdmin, type Actor } from "@/lib/services/access-policy";
import { recordAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/service-error";

/**
 * Idempotently retrieves the patient record linked to the given user ID.
 * If no record exists, creates a stub patient record with full_name from user.name
 * and a sequential patient_no (e.g. PAT-000001).
 *
 * This ensures every patient user has a profile record on first portal load or booking.
 */
export async function getOrCreatePatientForUser(userId: string): Promise<Patient> {
  // Check for an existing linked patient record
  const existing = await db
    .select()
    .from(patient)
    .where(eq(patient.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Fetch the user's name
  const userRecord = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const fullName = userRecord[0]?.name || "Patient";

  // Generate sequential identifier
  const seqResult = await db.execute<{ seq: string }>(
    sql`SELECT nextval('patient_no_seq')::text as seq`
  );
  const rawSeq = seqResult[0]?.seq || "1";
  const patientNo = `PAT-${String(rawSeq).padStart(6, "0")}`;

  // Insert stub patient record with conflict safety
  const [created] = await db
    .insert(patient)
    .values({
      userId,
      patientNo,
      fullName,
    })
    .onConflictDoNothing({ target: patient.userId })
    .returning();

  if (!created) {
    // Concurrent request already inserted it; retrieve existing
    const [concurrent] = await db
      .select()
      .from(patient)
      .where(eq(patient.userId, userId))
      .limit(1);

    return concurrent;
  }

  return created;
}

type PatientAuditField =
  | "fullName"
  | "phone"
  | "dateOfBirth"
  | "gender"
  | "address"
  | "emergencyContactName"
  | "emergencyContactPhone";

function changedFields<T extends Record<string, unknown>>(
  record: Patient,
  values: T
): PatientAuditField[] {
  return Object.entries(values)
    .filter(([key, value]) => record[key as keyof Patient] !== value)
    .map(([key]) => key as PatientAuditField);
}

async function updatePatient(
  patientId: string,
  values: ReceptionistPatientUpdate | PatientProfileUpdate,
  actor: Actor
) {
  return db.transaction(async (tx) => {
    if (!(await canViewPatientAdmin(actor, patientId, tx))) {
      throw new ServiceError("Patient not found.", 404, "NOT_FOUND");
    }
    const [current] = await tx
      .select()
      .from(patient)
      .where(eq(patient.id, patientId))
      .for("update");
    if (!current) throw new ServiceError("Patient not found.", 404, "NOT_FOUND");
    const fields = changedFields(current, values);
    if (fields.length === 0) return current;
    const [updated] = await tx
      .update(patient)
      .set(values)
      .where(eq(patient.id, patientId))
      .returning();
    await recordAudit(tx, {
      actorId: actor.userId,
      action: patientActions.updated,
      targetType: "patient",
      targetId: patientId,
      metadata: { changedFields: fields },
    });
    return updated;
  });
}

export async function updatePatientByReceptionist(
  patientId: string,
  values: ReceptionistPatientUpdate,
  actor: Actor
) {
  if (actor.role !== "receptionist")
    throw new ServiceError("Forbidden.", 403, "FORBIDDEN");
  return updatePatient(patientId, values, actor);
}

export async function updateOwnPatientProfile(
  values: PatientProfileUpdate,
  actor: Actor
) {
  if (actor.role !== "patient") throw new ServiceError("Forbidden.", 403, "FORBIDDEN");
  const [profile] = await db
    .select({ id: patient.id })
    .from(patient)
    .where(eq(patient.userId, actor.userId))
    .limit(1);
  if (!profile) throw new ServiceError("Patient not found.", 404, "NOT_FOUND");
  return updatePatient(profile.id, values, actor);
}
