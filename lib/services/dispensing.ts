import { and, asc, eq, gt, gte, sql } from "drizzle-orm";
import { pharmacyActions } from "@/lib/audit/actions/pharmacy";
import { colomboNow } from "@/lib/clinic-time";
import { db } from "@/lib/db";
import { dispenseRecord } from "@/lib/db/schema/dispense-record";
import { medicine } from "@/lib/db/schema/medicine";
import { prescription } from "@/lib/db/schema/prescription";
import { prescriptionItem } from "@/lib/db/schema/prescription-item";
import { stockBatch } from "@/lib/db/schema/stock-batch";
import { prescriptionParamsSchema } from "@/lib/schemas/prescription";
import { assertActiveActor, canViewPrescription, type Actor } from "./access-policy";
import { recordAudit } from "./audit";
import { ServiceError } from "./service-error";

export async function dispensePrescription(id: string, actor: Actor) {
  if (actor.role !== "pharmacist") {
    throw new ServiceError(
      "Only pharmacists can dispense prescriptions.",
      403,
      "FORBIDDEN"
    );
  }
  if (!prescriptionParamsSchema.safeParse({ id }).success) {
    throw new ServiceError("Invalid prescription identifier.", 400, "INVALID_ID");
  }

  await db.transaction(async (tx) => {
    await assertActiveActor(actor, tx);
    if (!(await canViewPrescription(actor, id, tx))) {
      throw new ServiceError("Prescription not found.", 404, "NOT_FOUND");
    }

    const [record] = await tx
      .select({ status: prescription.status })
      .from(prescription)
      .where(eq(prescription.id, id))
      .for("update");
    if (!record) throw new ServiceError("Prescription not found.", 404, "NOT_FOUND");
    if (record.status === "dispensed") {
      throw new ServiceError(
        "This prescription was already dispensed.",
        409,
        "ALREADY_DISPENSED"
      );
    }

    // Lock medicines' batches in the same order across concurrent prescriptions.
    const items = await tx
      .select({
        medicineId: medicine.id,
        name: medicine.name,
        quantity: prescriptionItem.quantity,
      })
      .from(prescriptionItem)
      .innerJoin(medicine, eq(prescriptionItem.medicineId, medicine.id))
      .where(eq(prescriptionItem.prescriptionId, id))
      .orderBy(asc(medicine.id), asc(prescriptionItem.id));
    if (!items.length) {
      throw new ServiceError("Nothing to dispense.", 409, "NOTHING_TO_DISPENSE");
    }

    const { date: today } = colomboNow();
    const shortMedicines = new Set<string>();
    for (const item of items) {
      const batches = await tx
        .select({ id: stockBatch.id, quantity: stockBatch.quantityOnHand })
        .from(stockBatch)
        .where(
          and(
            eq(stockBatch.medicineId, item.medicineId),
            gte(stockBatch.expiryDate, today),
            gt(stockBatch.quantityOnHand, 0)
          )
        )
        .orderBy(asc(stockBatch.expiryDate), asc(stockBatch.id))
        .for("update");

      let remaining = item.quantity;
      for (const batch of batches) {
        const quantity = Math.min(remaining, batch.quantity);
        const [updated] = await tx
          .update(stockBatch)
          .set({ quantityOnHand: sql`${stockBatch.quantityOnHand} - ${quantity}` })
          .where(
            and(eq(stockBatch.id, batch.id), gte(stockBatch.quantityOnHand, quantity))
          )
          .returning({ id: stockBatch.id });
        if (updated) remaining -= quantity;
        if (remaining === 0) break;
      }
      if (remaining > 0) shortMedicines.add(item.name);
    }
    if (shortMedicines.size) {
      throw new ServiceError(
        `Insufficient stock for: ${[...shortMedicines].join(", ")}.`,
        409,
        "INSUFFICIENT_STOCK"
      );
    }

    await tx
      .insert(dispenseRecord)
      .values({ prescriptionId: id, dispensedBy: actor.userId });
    await tx
      .update(prescription)
      .set({ status: "dispensed" })
      .where(eq(prescription.id, id));
    await recordAudit(tx, {
      actorId: actor.userId,
      action: pharmacyActions.prescriptionDispensed,
      targetType: "prescription",
      targetId: id,
      metadata: { itemCount: items.length },
    });
  });
}
