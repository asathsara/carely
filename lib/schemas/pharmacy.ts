import { z } from "zod";

export const medicineParamsSchema = z.object({ id: z.uuid() }).strict();

export const createMedicineSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    form: z.string().trim().min(1).max(100),
    strength: z.string().trim().min(1).max(100),
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateMedicineSchema = createMedicineSchema
  .extend({ isActive: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one change.");

export const receiveStockBatchSchema = z
  .object({
    batchNo: z.string().trim().min(1).max(80),
    expiryDate: z.iso.date(),
    quantity: z.number().int().min(0).max(2147483647),
  })
  .strict();

export type CreateMedicineInput = z.input<typeof createMedicineSchema>;
export type UpdateMedicineInput = z.infer<typeof updateMedicineSchema>;
export type ReceiveStockBatchInput = z.infer<typeof receiveStockBatchSchema>;
export type MedicineDetails = z.output<typeof createMedicineSchema> & { id: string };
export type MedicineStockView = MedicineDetails & {
  quantityOnHand: number;
  nextExpiryDate: string | null;
};
export type StockBatchView = {
  id: string;
  medicineId: string;
  batchNo: string;
  expiryDate: string;
  quantityOnHand: number;
  receivedAt: string;
};
export type MedicineCatalogueResponse = { medicines: MedicineStockView[]; today: string };
export type StockBatchesResponse = { batches: StockBatchView[]; today: string };
