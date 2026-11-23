import { z } from "zod";

const name = z.string().trim().min(1, "Name is required").max(120);

export const specialtyCreateSchema = z.object({ name }).strict();
export const specialtyUpdateSchema = z.object({ name }).strict();
export const doctorSpecialtySchema = z
  .object({ specialtyId: z.uuid("Choose a valid specialty") })
  .strict();
