import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { medicine } from "@/lib/db/schema/medicine";
import { patient } from "@/lib/db/schema/patient";
import { prescriptionItem } from "@/lib/db/schema/prescription-item";
import { prescription } from "@/lib/db/schema/prescription";
import { encounter } from "@/lib/db/schema/encounter";
import { prescriptionActions } from "@/lib/audit/actions/prescription";
import {
  createPrescriptionSchema,
  prescriptionEncounterParamsSchema,
  prescriptionParamsSchema,
  type CreatedPrescription,
  type CreatePrescriptionInput,
  type PrescriptionItemView,
  type PrescriptionView,
} from "@/lib/schemas/prescription";
import { assertActiveActor, canViewPrescription, type Actor } from "./access-policy";
import { recordAudit } from "./audit";
import { assertEncounterWritable } from "./encounter";
import { ServiceError } from "./service-error";

function assertDoctor(actor: Actor) {
  if (actor.role !== "doctor") {
    throw new ServiceError("Only doctors can create prescriptions.", 403, "FORBIDDEN");
  }
}

function assertEncounterId(encounterId: string) {
  if (!prescriptionEncounterParamsSchema.safeParse({ id: encounterId }).success) {
    throw new ServiceError("Invalid encounter identifier.", 400, "INVALID_ID");
  }
}

function toPrescriptionView(
  header: {
    id: string;
    encounterId: string;
    doctorId: string;
    status: string;
    createdAt: Date;
  },
  items: PrescriptionItemView[]
): PrescriptionView {
  return {
    ...header,
    createdAt: header.createdAt.toISOString(),
    itemCount: items.length,
    items,
  };
}

async function getItems(prescriptionId: string): Promise<PrescriptionItemView[]> {
  return db
    .select({
      medicineId: medicine.id,
      name: medicine.name,
      form: medicine.form,
      strength: medicine.strength,
      dosage: prescriptionItem.dosage,
      frequency: prescriptionItem.frequency,
      durationDays: prescriptionItem.durationDays,
      quantity: prescriptionItem.quantity,
      instructions: prescriptionItem.instructions,
    })
    .from(prescriptionItem)
    .innerJoin(medicine, eq(prescriptionItem.medicineId, medicine.id))
    .where(eq(prescriptionItem.prescriptionId, prescriptionId))
    .orderBy(asc(prescriptionItem.id));
}

export async function createPrescription(input: {
  encounterId: string;
  prescription: CreatePrescriptionInput;
  actor: Actor;
}): Promise<CreatedPrescription> {
  assertDoctor(input.actor);
  assertEncounterId(input.encounterId);
  const parsed = createPrescriptionSchema.safeParse(input.prescription);
  if (!parsed.success) {
    throw new ServiceError("Provide a valid prescription.", 400, "INVALID_PRESCRIPTION");
  }
  return db.transaction(async (tx) => {
    const visit = await assertEncounterWritable(input.encounterId, input.actor, tx);
    const medicineIds = parsed.data.items.map((item) => item.medicineId);
    const activeMedicines = await tx
      .select({ id: medicine.id })
      .from(medicine)
      .where(and(inArray(medicine.id, medicineIds), eq(medicine.isActive, true)));
    if (activeMedicines.length !== medicineIds.length) {
      throw new ServiceError(
        "One or more medicines are unavailable.",
        400,
        "INVALID_MEDICINE"
      );
    }
    const createdAt = new Date();
    const [saved] = await tx
      .insert(prescription)
      .values({
        encounterId: visit.id,
        doctorId: visit.doctorId,
        createdAt,
      })
      .returning({
        id: prescription.id,
        encounterId: prescription.encounterId,
        doctorId: prescription.doctorId,
        status: prescription.status,
        createdAt: prescription.createdAt,
      });
    await tx.insert(prescriptionItem).values(
      parsed.data.items.map((item) => ({
        prescriptionId: saved.id,
        medicineId: item.medicineId,
        dosage: item.dosage,
        frequency: item.frequency,
        durationDays: item.durationDays,
        quantity: item.quantity,
        instructions: item.instructions ?? null,
      }))
    );
    await recordAudit(tx, {
      actorId: input.actor.userId,
      action: prescriptionActions.created,
      targetType: "prescription",
      targetId: saved.id,
      metadata: { itemCount: parsed.data.items.length },
    });
    return {
      ...saved,
      createdAt: saved.createdAt.toISOString(),
      itemCount: parsed.data.items.length,
    };
  });
}

export async function getPrescription(input: {
  prescriptionId: string;
  actor: Actor;
}): Promise<PrescriptionView> {
  if (!prescriptionParamsSchema.safeParse({ id: input.prescriptionId }).success) {
    throw new ServiceError("Invalid prescription identifier.", 400, "INVALID_ID");
  }
  if (input.actor.role !== "pharmacist") {
    throw new ServiceError(
      "Only pharmacists can access this prescription.",
      403,
      "FORBIDDEN"
    );
  }
  await assertActiveActor(input.actor);
  if (!(await canViewPrescription(input.actor, input.prescriptionId))) {
    throw new ServiceError("Prescription not found.", 404, "NOT_FOUND");
  }
  const [header] = await db
    .select({
      id: prescription.id,
      encounterId: prescription.encounterId,
      doctorId: prescription.doctorId,
      status: prescription.status,
      createdAt: prescription.createdAt,
    })
    .from(prescription)
    .where(eq(prescription.id, input.prescriptionId))
    .limit(1);
  if (!header) throw new ServiceError("Prescription not found.", 404, "NOT_FOUND");
  return toPrescriptionView(header, await getItems(header.id));
}

export async function getPatientPrescriptions(actor: Actor): Promise<PrescriptionView[]> {
  if (actor.role !== "patient") {
    throw new ServiceError(
      "Only patients can access their prescriptions.",
      403,
      "FORBIDDEN"
    );
  }
  await assertActiveActor(actor);
  const [profile] = await db
    .select({ id: patient.id })
    .from(patient)
    .where(eq(patient.userId, actor.userId))
    .limit(1);
  if (!profile) throw new ServiceError("Patient record not found.", 404, "NOT_FOUND");
  const headers = await db
    .select({
      id: prescription.id,
      encounterId: prescription.encounterId,
      doctorId: prescription.doctorId,
      status: prescription.status,
      createdAt: prescription.createdAt,
    })
    .from(prescription)
    .innerJoin(encounter, eq(prescription.encounterId, encounter.id))
    .where(eq(encounter.patientId, profile.id))
    .orderBy(asc(prescription.createdAt), asc(prescription.id));
  return Promise.all(
    headers.map(async (header) => toPrescriptionView(header, await getItems(header.id)))
  );
}
