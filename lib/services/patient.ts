import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { patient, type Patient } from "@/lib/db/schema/patient";

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
