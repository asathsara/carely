import { z } from "zod";

export const prescriptionEncounterParamsSchema = z.object({ id: z.uuid() }).strict();
export const prescriptionParamsSchema = z.object({ id: z.uuid() }).strict();

const prescriptionItemSchema = z
  .object({
    medicineId: z.uuid(),
    dosage: z.string().trim().min(1).max(200),
    frequency: z.string().trim().min(1).max(200),
    durationDays: z.number().int().min(1).max(365),
    quantity: z.number().int().min(1).max(10000),
    instructions: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

export const createPrescriptionSchema = z
  .object({ items: z.array(prescriptionItemSchema).min(1).max(20) })
  .strict()
  .superRefine(({ items }, context) => {
    const seen = new Set<string>();
    for (const [index, item] of items.entries()) {
      if (seen.has(item.medicineId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "medicineId"],
          message: "Each medicine can appear only once in a prescription.",
        });
      }
      seen.add(item.medicineId);
    }
  });

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export type CreatedPrescription = {
  id: string;
  encounterId: string;
  doctorId: string;
  status: string;
  createdAt: string;
  itemCount: number;
};
export type CreatePrescriptionResponse = { prescription: CreatedPrescription };
export type PrescriptionItemView = {
  id: string;
  medicineId: string;
  name: string;
  form: string;
  strength: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  quantity: number;
  instructions: string | null;
};
export type PrescriptionView = CreatedPrescription & { items: PrescriptionItemView[] };
export type DispensingEligibility =
  | { status: "ready" | "dispensed" | "empty" }
  | { status: "insufficient_stock"; shortMedicines: string[] };
export type PharmacistPrescriptionView = PrescriptionView & {
  dispensing: DispensingEligibility;
};
export type PrescriptionResponse = { prescription: PharmacistPrescriptionView };
export type PatientPrescriptionsResponse = { prescriptions: PrescriptionView[] };
