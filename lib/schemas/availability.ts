import { z } from "zod";
import type { DoctorAvailability } from "@/lib/db/schema/doctor-availability";

const clinicTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time in HH:MM format");

export const availabilitySessionSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: clinicTimeSchema,
    endTime: clinicTimeSchema,
    maxPatients: z
      .number("Enter the patient capacity")
      .int("Capacity must be a whole number")
      .min(1, "Capacity must be at least 1")
      .max(32767, "Capacity must be 32,767 or fewer"),
    isActive: z.boolean(),
  })
  .strict()
  .refine((session) => session.endTime > session.startTime, {
    message: "End time must be later than start time",
    path: ["endTime"],
  });

export const saveAvailabilitySchema = z
  .object({
    sessions: z.array(availabilitySessionSchema).min(1).max(7),
  })
  .strict()
  .superRefine(({ sessions }, context) => {
    const weekdays = new Set<number>();
    sessions.forEach((session, index) => {
      if (weekdays.has(session.dayOfWeek)) {
        context.addIssue({
          code: "custom",
          message: "Only one clinic session is allowed per weekday",
          path: ["sessions", index, "dayOfWeek"],
        });
      }
      weekdays.add(session.dayOfWeek);
    });
  });

export type AvailabilitySessionInput = z.infer<typeof availabilitySessionSchema>;
export type SaveAvailabilityInput = z.infer<typeof saveAvailabilitySchema>;

export interface AvailabilityResponse {
  availability: DoctorAvailability[];
}
