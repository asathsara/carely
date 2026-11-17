import { z } from "zod";

export const doctorVisitParamsSchema = z.object({ queueEntryId: z.uuid() }).strict();
export const doctorPatientHistoryParamsSchema = z
  .object({ patientId: z.uuid() })
  .strict();

export type ReviewNote = { id: string; content: string; createdAt: string };
export type DoctorVisitReview = {
  encounterId: string;
  queueEntryId: string;
  intake: { content: string; createdAt: string } | null;
  vitals: Record<string, unknown> | null;
  notes: ReviewNote[];
};
export type DoctorVisitResponse = { visit: DoctorVisitReview };

export type PatientHistoryEncounter = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  notes: ReviewNote[];
  prescriptions: { id: string; createdAt: string; status: string }[];
};
export type PatientHistory = { patientId: string; encounters: PatientHistoryEncounter[] };
export type PatientHistoryResponse = { history: PatientHistory };
