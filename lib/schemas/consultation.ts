import { z } from "zod";

export const openConsultationParamsSchema = z.object({ entryId: z.uuid() }).strict();
export const openConsultationSchema = z.object({}).strict();
export const completeConsultationParamsSchema = z.object({ id: z.uuid() }).strict();
export const completeConsultationSchema = z.object({}).strict();

export type OpenedConsultation = {
  encounterId: string;
  queueEntryId: string;
  status: "with_doctor";
  calledAt: string;
};

export type OpenConsultationResponse = { consultation: OpenedConsultation };

export type CompletedConsultation = {
  encounterId: string;
  queueEntryId: string;
  status: "completed";
  endedAt: string;
};

export type CompleteConsultationResponse = { consultation: CompletedConsultation };
