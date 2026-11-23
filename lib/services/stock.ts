import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { medicine } from "@/lib/db/schema/medicine";
import { stockBatch } from "@/lib/db/schema/stock-batch";
import { colomboNow } from "@/lib/clinic-time";
import { pharmacyActions } from "@/lib/audit/actions/pharmacy";
import {
  createMedicineSchema,
  medicineParamsSchema,
  receiveStockBatchSchema,
  updateMedicineSchema,
  type MedicineCatalogueResponse,
  type MedicineDetails,
  type StockBatchesResponse,
  type StockBatchView,
} from "@/lib/schemas/pharmacy";
import { assertActiveActor, type Actor } from "./access-policy";
import { recordAudit } from "./audit";
import { ServiceError } from "./service-error";

function assertPharmacist(actor: Actor) {
  if (actor.role !== "pharmacist") {
    throw new ServiceError("Only pharmacists can manage stock.", 403, "FORBIDDEN");
  }
}

export async function listMedicines(actor: Actor): Promise<MedicineCatalogueResponse> {
  assertPharmacist(actor);
  await assertActiveActor(actor);
  const { date: today } = colomboNow();
  const medicines = await db
    .select({
      id: medicine.id,
      name: medicine.name,
      form: medicine.form,
      strength: medicine.strength,
      isActive: medicine.isActive,
      quantityOnHand: sql<number>`coalesce(sum(${stockBatch.quantityOnHand}), 0)`.mapWith(
        Number
      ),
      nextExpiryDate: sql<
        string | null
      >`min(case when ${stockBatch.quantityOnHand} > 0 then ${stockBatch.expiryDate} end)`,
    })
    .from(medicine)
    .leftJoin(
      stockBatch,
      and(eq(stockBatch.medicineId, medicine.id), gte(stockBatch.expiryDate, today))
    )
    .groupBy(medicine.id)
    .orderBy(asc(medicine.name), asc(medicine.id));
  return { medicines, today };
}

export async function createMedicine(
  body: unknown,
  actor: Actor
): Promise<MedicineDetails> {
  assertPharmacist(actor);
  const input = createMedicineSchema.parse(body);
  return db.transaction(async (tx) => {
    await assertActiveActor(actor, tx);
    const [saved] = await tx.insert(medicine).values(input).returning();
    await recordAudit(tx, {
      actorId: actor.userId,
      action: pharmacyActions.medicineCreated,
      targetType: "medicine",
      targetId: saved.id,
      metadata: {},
    });
    return saved;
  });
}

export async function updateMedicine(
  id: string,
  body: unknown,
  actor: Actor
): Promise<MedicineDetails> {
  assertPharmacist(actor);
  medicineParamsSchema.parse({ id });
  const input = updateMedicineSchema.parse(body);
  return db.transaction(async (tx) => {
    await assertActiveActor(actor, tx);
    const [existing] = await tx
      .select()
      .from(medicine)
      .where(eq(medicine.id, id))
      .for("update");
    if (!existing) throw new ServiceError("Medicine not found.", 404, "NOT_FOUND");
    const changedFields = (Object.keys(input) as (keyof typeof input)[]).filter(
      (key) => input[key] !== existing[key]
    );
    if (!changedFields.length) return existing;
    const [saved] = await tx
      .update(medicine)
      .set(input)
      .where(eq(medicine.id, id))
      .returning();
    await recordAudit(tx, {
      actorId: actor.userId,
      action: pharmacyActions.medicineUpdated,
      targetType: "medicine",
      targetId: id,
      metadata: { changedFields },
    });
    return saved;
  });
}

export async function listStockBatches(
  id: string,
  actor: Actor
): Promise<StockBatchesResponse> {
  assertPharmacist(actor);
  medicineParamsSchema.parse({ id });
  await assertActiveActor(actor);
  const [existing] = await db
    .select({ id: medicine.id })
    .from(medicine)
    .where(eq(medicine.id, id))
    .limit(1);
  if (!existing) throw new ServiceError("Medicine not found.", 404, "NOT_FOUND");
  const batches = await db
    .select()
    .from(stockBatch)
    .where(eq(stockBatch.medicineId, id))
    .orderBy(desc(stockBatch.receivedAt), asc(stockBatch.id));
  return {
    batches: batches.map((batch) => ({
      ...batch,
      receivedAt: batch.receivedAt.toISOString(),
    })),
    today: colomboNow().date,
  };
}

export async function receiveStockBatch(
  id: string,
  body: unknown,
  actor: Actor
): Promise<StockBatchView> {
  assertPharmacist(actor);
  medicineParamsSchema.parse({ id });
  const input = receiveStockBatchSchema.parse(body);
  return db.transaction(async (tx) => {
    await assertActiveActor(actor, tx);
    const [existing] = await tx
      .select({ id: medicine.id, isActive: medicine.isActive })
      .from(medicine)
      .where(eq(medicine.id, id))
      .for("update");
    if (!existing) throw new ServiceError("Medicine not found.", 404, "NOT_FOUND");
    if (!existing.isActive) {
      throw new ServiceError(
        "Activate this medicine before receiving stock.",
        409,
        "INACTIVE_MEDICINE"
      );
    }
    if (input.expiryDate < colomboNow().date) {
      throw new ServiceError("Cannot receive expired stock.", 400, "EXPIRED_BATCH");
    }
    const [saved] = await tx
      .insert(stockBatch)
      .values({
        medicineId: id,
        batchNo: input.batchNo,
        expiryDate: input.expiryDate,
        quantityOnHand: input.quantity,
      })
      .returning();
    await recordAudit(tx, {
      actorId: actor.userId,
      action: pharmacyActions.stockReceived,
      targetType: "stock_batch",
      targetId: saved.id,
      metadata: { medicineId: id, quantity: input.quantity },
    });
    return { ...saved, receivedAt: saved.receivedAt.toISOString() };
  });
}
