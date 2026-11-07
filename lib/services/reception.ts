import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { patient } from "@/lib/db/schema/patient";
import type {
  CreateWalkInPatientInput,
  ReceptionPatientSummary,
} from "@/lib/schemas/reception";

export class ReceptionServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = "ReceptionServiceError";
  }
}

function toSummary(row: typeof patient.$inferSelect): ReceptionPatientSummary {
  return {
    id: row.id,
    patientNo: row.patientNo,
    fullName: row.fullName,
    dateOfBirth: row.dateOfBirth,
    phone: row.phone,
  };
}

async function findExactDuplicates(input: CreateWalkInPatientInput) {
  if (!input.phone || !input.dateOfBirth) return [];

  const rows = await db
    .select()
    .from(patient)
    .where(
      and(
        eq(patient.phone, input.phone),
        eq(patient.dateOfBirth, input.dateOfBirth),
        sql`lower(${patient.fullName}) = lower(${input.fullName})`
      )
    )
    .orderBy(asc(patient.patientNo));

  return rows.map(toSummary);
}

export async function createWalkInPatient(input: CreateWalkInPatientInput): Promise<{
  patient?: ReceptionPatientSummary;
  duplicateCandidates: ReceptionPatientSummary[];
}> {
  const duplicateCandidates = await findExactDuplicates(input);
  if (duplicateCandidates.length > 0 && !input.confirmDuplicate) {
    return { duplicateCandidates };
  }

  const result = await db.transaction(async (tx) => {
    const sequence = await tx.execute<{ value: string }>(
      sql`select nextval('patient_no_seq')::text as value`
    );
    const patientNo = `PAT-${String(sequence[0]?.value ?? "1").padStart(6, "0")}`;
    const [created] = await tx
      .insert(patient)
      .values({
        patientNo,
        fullName: input.fullName,
        phone: input.phone,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        address: input.address,
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
      })
      .returning();
    return created;
  });

  return { patient: toSummary(result), duplicateCandidates };
}

export async function searchReceptionPatients(
  query: string
): Promise<ReceptionPatientSummary[]> {
  const term = query.trim();
  const rows = await db
    .select()
    .from(patient)
    .where(
      or(
        ilike(patient.patientNo, `%${term}%`),
        ilike(patient.phone, `%${term}%`),
        ilike(patient.fullName, `%${term}%`)
      )
    )
    .orderBy(asc(patient.fullName), asc(patient.patientNo))
    .limit(25);
  return rows.map(toSummary);
}

export async function getReceptionPatientDetails(patientId: string) {
  const [record] = await db
    .select()
    .from(patient)
    .where(eq(patient.id, patientId))
    .limit(1);
  if (!record) {
    throw new ReceptionServiceError("Patient not found", 404, "PATIENT_NOT_FOUND");
  }

  // This administrative view intentionally excludes appointments and clinical records.
  return {
    ...toSummary(record),
    gender: record.gender,
    address: record.address,
    emergencyContactName: record.emergencyContactName,
    emergencyContactPhone: record.emergencyContactPhone,
    hasPortalAccount: record.userId !== null,
  };
}
