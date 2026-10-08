import { z } from "zod";

export const metricSchema = z.object({
  label: z.string(),
  value: z.string(),
  note: z.string().optional(),
  tone: z.enum(["blue", "sky", "green", "amber", "red"]).optional(),
});
export const listItemSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  meta: z.string().optional(),
  status: z.string().optional(),
  href: z.string().optional(),
});
export const screenDataSchema = z.object({
  metrics: z.array(metricSchema).default([]),
  items: z.array(listItemSchema).default([]),
});
export const doctorClinicalNoteSchema = z.object({
  complaint: z.string().trim().min(1, "Enter the chief complaint."),
  observations: z.string().trim().min(1, "Enter observations."),
  assessment: z.string().trim().min(1, "Enter an assessment."),
  plan: z.string().trim().min(1, "Enter a care plan."),
});

export type Metric = z.infer<typeof metricSchema>;
export type ListItem = z.infer<typeof listItemSchema>;
export type ScreenData = z.infer<typeof screenDataSchema>;
export type DoctorClinicalNote = z.infer<typeof doctorClinicalNoteSchema>;
