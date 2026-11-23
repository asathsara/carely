import { z } from "zod";

const name = z.string().trim().min(1, "Name is required").max(120);

export const specialtyCreateSchema = z.object({ name }).strict();
export const specialtyUpdateSchema = z.object({ name }).strict();
export const doctorSpecialtySchema = z
  .object({ specialtyId: z.uuid("Choose a valid specialty") })
  .strict();

export const visitReasonCreateSchema = z
  .object({ name, specialtyId: z.uuid("Choose a specialty") })
  .strict();
export const visitReasonUpdateSchema = visitReasonCreateSchema;

export const doctorFinderQuerySchema = z.object({ reasonId: z.uuid("Invalid reason") }).strict();

export const settingsSchema = z
  .object({
    hospitalName: name,
    address: z.string().trim().max(500).nullable(),
    phone: z.string().trim().max(50).nullable(),
    email: z.email("Provide a valid email address").max(254).nullable(),
  })
  .strict();
