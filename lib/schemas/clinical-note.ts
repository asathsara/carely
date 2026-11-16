import { z } from "zod";

export const clinicalNoteEncounterParamsSchema = z.object({ id: z.uuid() }).strict();

// Clinical notes are append-only. Corrections are recorded as a subsequent note.
export const createClinicalNoteSchema = z
  .object({
    content: z.string().trim().min(1).max(5000),
  })
  .strict();

export type CreateClinicalNoteInput = z.infer<typeof createClinicalNoteSchema>;

export type ClinicalNoteRecord = {
  id: string;
  encounterId: string;
  content: string;
  createdAt: string;
};

export type CreatedClinicalNote = ClinicalNoteRecord;
export type CreateClinicalNoteResponse = { note: CreatedClinicalNote };
export type ClinicalNotesResponse = { notes: ClinicalNoteRecord[] };
