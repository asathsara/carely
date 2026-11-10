import { z } from "zod";

const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .nullable()
    .optional()
    .transform((value) => value || null);

export const receptionistPatientUpdateSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).optional(),
    phone: optionalText(24),
    dateOfBirth: z.string().date().nullable().optional(),
    gender: optionalText(40),
    address: optionalText(240),
    emergencyContactName: optionalText(120),
    emergencyContactPhone: optionalText(24),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field.");

export const patientProfileUpdateSchema = z
  .object({
    phone: optionalText(24),
    address: optionalText(240),
    emergencyContactName: optionalText(120),
    emergencyContactPhone: optionalText(24),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field.");

export type ReceptionistPatientUpdate = z.infer<typeof receptionistPatientUpdateSchema>;
export type PatientProfileUpdate = z.infer<typeof patientProfileUpdateSchema>;
