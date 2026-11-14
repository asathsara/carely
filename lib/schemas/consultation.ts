import { z } from "zod";

export const openConsultationParamsSchema = z.object({ entryId: z.uuid() }).strict();
export const openConsultationSchema = z.object({}).strict();

export type OpenedConsultation = {
  encounterId: string;
  queueEntryId: string;
  status: "with_doctor";
  calledAt: string;
};

export type OpenConsultationResponse = { consultation: OpenedConsultation };
