import { z } from "zod";

const reservedMeasurementKeys = new Set([
  "constructor",
  "prototype",
  "nic",
  "nationalid",
  "identitydocument",
  "governmentid",
  "allergy",
  "allergies",
  "bpsystolic",
  "bpdiastolic",
  "heartrate",
  "respiratoryrate",
  "temperaturec",
  "spo2",
  "weightkg",
  "heightcm",
]);

const additionalMeasurementsSchema = z.preprocess(
  (value, context) => {
    if (value && typeof value === "object" && Object.hasOwn(value, "__proto__")) {
      context.addIssue({
        code: "custom",
        message: "Use a supported additional measurement key.",
      });
      return z.NEVER;
    }
    return value;
  },
  z
    .record(
      z
        .string()
        .max(40)
        .regex(/^[A-Za-z][A-Za-z0-9_]*$/)
        .refine(
          (key) => !reservedMeasurementKeys.has(key.replaceAll("_", "").toLowerCase()),
          "Use a supported additional measurement key."
        ),
      z.union([z.number(), z.string().trim().min(1).max(200), z.boolean(), z.null()])
    )
    .refine(
      (value) => Object.keys(value).length <= 20,
      "Use at most 20 extra measurements."
    )
    .refine(
      (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 4096,
      "Additional measurements must not exceed 4096 bytes."
    )
);

// Input limits for the prototype, not normal ranges or clinical recommendations.
export const intakeVitalsSchema = z
  .object({
    bpSystolic: z.number().int().min(20).max(300).nullable().optional(),
    bpDiastolic: z.number().int().min(10).max(200).nullable().optional(),
    heartRate: z.number().int().min(1).max(300).nullable().optional(),
    respiratoryRate: z.number().int().min(1).max(100).nullable().optional(),
    temperatureC: z.number().min(25).max(45).multipleOf(0.1).nullable().optional(),
    spo2: z.number().int().min(0).max(100).nullable().optional(),
    weightKg: z.number().min(0.1).max(500).multipleOf(0.1).nullable().optional(),
    heightCm: z.number().min(10).max(300).multipleOf(0.1).nullable().optional(),
    additional: additionalMeasurementsSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      !Object.entries(value).some(([key, measurement]) =>
        key === "additional"
          ? measurement != null && Object.values(measurement).some((item) => item != null)
          : measurement != null
      )
    ) {
      context.addIssue({ code: "custom", message: "Record at least one measurement." });
    }
    const hasSystolic = value.bpSystolic != null;
    const hasDiastolic = value.bpDiastolic != null;
    if (hasSystolic !== hasDiastolic) {
      context.addIssue({
        code: "custom",
        path: [hasSystolic ? "bpDiastolic" : "bpSystolic"],
        message: "Provide both blood-pressure measurements.",
      });
    }
    if (
      value.bpSystolic != null &&
      value.bpDiastolic != null &&
      value.bpSystolic <= value.bpDiastolic
    ) {
      context.addIssue({
        code: "custom",
        path: ["bpSystolic"],
        message: "Systolic pressure must exceed diastolic pressure.",
      });
    }
  });

export const recordIntakeSchema = z
  .object({
    vitals: intakeVitalsSchema,
    complaint: z.string().trim().min(1).max(2000),
    preliminaryNote: z.string().trim().min(1).max(5000),
  })
  .strict();

export const intakeEncounterParamsSchema = z.object({ id: z.uuid() }).strict();

export type RecordIntakeInput = z.infer<typeof recordIntakeSchema>;
export type RecordedIntake = {
  encounterId: string;
  queueEntryId: string;
  status: "intake_done";
  vitalsId: string;
  preliminaryNoteId: string;
  recordedAt: string;
};
export type RecordIntakeResponse = { intake: RecordedIntake };

export type NurseQueueEntry = {
  id: string;
  encounterId: string;
  status: "waiting";
  checkedInAt: string;
  appointmentId: string;
  appointmentNo: number;
  doctorId: string;
  doctorName: string;
  patient: { id: string; patientNo: string; fullName: string };
};

export type NurseQueueResponse = { entries: NurseQueueEntry[] };

export type NurseIntakeReceipt = { encounterId: string; recordedAt: string };
