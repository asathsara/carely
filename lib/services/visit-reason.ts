import { asc, count, eq } from "drizzle-orm";
import { adminConfigActions } from "@/lib/audit/actions/admin-config";
import { db } from "@/lib/db";
import { specialty } from "@/lib/db/schema/specialty";
import { visitReason } from "@/lib/db/schema/visit-reason";
import { appointment } from "@/lib/db/schema/appointment";
import { assertActiveActor, type Actor } from "@/lib/services/access-policy";
import { recordAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/service-error";

type VisitReasonInput = { name: string; specialtyId: string };

function requireAdmin(actor: Actor) {
  if (actor.role !== "admin") throw new ServiceError("Forbidden.", 403, "FORBIDDEN");
}

async function ensureSpecialty(specialtyId: string) {
  const [selected] = await db.select({ id: specialty.id }).from(specialty).where(eq(specialty.id, specialtyId)).limit(1);
  if (!selected) throw new ServiceError("Specialty not found.", 404, "SPECIALTY_NOT_FOUND");
}

export async function listVisitReasons() {
  return db
    .select({ id: visitReason.id, name: visitReason.name, specialtyId: specialty.id, specialtyName: specialty.name })
    .from(visitReason)
    .innerJoin(specialty, eq(visitReason.specialtyId, specialty.id))
    .orderBy(asc(visitReason.name));
}

export async function createVisitReason(input: VisitReasonInput, actor: Actor) {
  requireAdmin(actor);
  await ensureSpecialty(input.specialtyId);
  return db.transaction(async (tx) => {
    await assertActiveActor(actor, tx);
    const [created] = await tx.insert(visitReason).values(input).returning();
    await recordAudit(tx, { actorId: actor.userId, action: adminConfigActions.visitReasonCreated, targetType: "visit_reason", targetId: created.id });
    return created;
  });
}

export async function updateVisitReason(id: string, input: VisitReasonInput, actor: Actor) {
  requireAdmin(actor);
  await ensureSpecialty(input.specialtyId);
  return db.transaction(async (tx) => {
    await assertActiveActor(actor, tx);
    const [current] = await tx
      .select()
      .from(visitReason)
      .where(eq(visitReason.id, id))
      .for("update");
    if (!current) throw new ServiceError("Visit reason not found.", 404, "NOT_FOUND");
    const [updated] = await tx.update(visitReason).set(input).where(eq(visitReason.id, id)).returning();
    const changedFields: Array<"name" | "specialtyId"> = [
      ...(current.name === input.name ? [] : (["name"] as const)),
      ...(current.specialtyId === input.specialtyId ? [] : (["specialtyId"] as const)),
    ];
    if (changedFields.length) {
      await recordAudit(tx, { actorId: actor.userId, action: adminConfigActions.visitReasonUpdated, targetType: "visit_reason", targetId: id, metadata: { changedFields } });
    }
    return updated;
  });
}

export async function deleteVisitReason(id: string, actor: Actor) {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    await assertActiveActor(actor, tx);
    const [appointmentReference] = await tx
      .select({ total: count() })
      .from(appointment)
      .where(eq(appointment.visitReasonId, id));
    if (Number(appointmentReference.total) > 0) {
      throw new ServiceError(
        "Visit reason is referenced by one or more appointments.",
        409,
        "VISIT_REASON_IN_USE"
      );
    }
    const [deleted] = await tx.delete(visitReason).where(eq(visitReason.id, id)).returning();
    if (!deleted) throw new ServiceError("Visit reason not found.", 404, "NOT_FOUND");
  });
}
