import { asc, count, eq } from "drizzle-orm";
import { adminConfigActions } from "@/lib/audit/actions/admin-config";
import { db } from "@/lib/db";
import { doctor } from "@/lib/db/schema/doctor";
import { specialty } from "@/lib/db/schema/specialty";
import { visitReason } from "@/lib/db/schema/visit-reason";
import { recordAudit } from "@/lib/services/audit";
import { assertActiveActor, type Actor } from "@/lib/services/access-policy";
import { ServiceError } from "@/lib/services/service-error";

function requireAdmin(actor: Actor) {
  if (actor.role !== "admin") throw new ServiceError("Forbidden.", 403, "FORBIDDEN");
}

export async function listSpecialties() {
  return db.select({ id: specialty.id, name: specialty.name }).from(specialty).orderBy(asc(specialty.name));
}

export async function createSpecialty(name: string, actor: Actor) {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    await assertActiveActor(actor, tx);
    const [created] = await tx.insert(specialty).values({ name }).returning();
    await recordAudit(tx, {
      actorId: actor.userId,
      action: adminConfigActions.specialtyCreated,
      targetType: "specialty",
      targetId: created.id,
    });
    return created;
  });
}

export async function updateSpecialty(id: string, name: string, actor: Actor) {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    await assertActiveActor(actor, tx);
    const [updated] = await tx
      .update(specialty)
      .set({ name })
      .where(eq(specialty.id, id))
      .returning();
    if (!updated) throw new ServiceError("Specialty not found.", 404, "NOT_FOUND");
    await recordAudit(tx, {
      actorId: actor.userId,
      action: adminConfigActions.specialtyUpdated,
      targetType: "specialty",
      targetId: id,
      metadata: { changedFields: ["name"] },
    });
    return updated;
  });
}

export async function deleteSpecialty(id: string, actor: Actor) {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    await assertActiveActor(actor, tx);
    const [doctorReference] = await tx.select({ total: count() }).from(doctor).where(eq(doctor.specialtyId, id));
    if (Number(doctorReference.total) > 0) {
      throw new ServiceError("Specialty is assigned to one or more doctors.", 409, "SPECIALTY_IN_USE");
    }
    const [reasonReference] = await tx.select({ total: count() }).from(visitReason).where(eq(visitReason.specialtyId, id));
    if (Number(reasonReference.total) > 0) {
      throw new ServiceError("Specialty is assigned to one or more visit reasons.", 409, "SPECIALTY_IN_USE");
    }
    const [deleted] = await tx.delete(specialty).where(eq(specialty.id, id)).returning();
    if (!deleted) throw new ServiceError("Specialty not found.", 404, "NOT_FOUND");
  });
}

export async function changeDoctorSpecialty(userId: string, specialtyId: string, actor: Actor) {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    await assertActiveActor(actor, tx);
    const [selectedSpecialty] = await tx
      .select({ id: specialty.id })
      .from(specialty)
      .where(eq(specialty.id, specialtyId))
      .limit(1);
    if (!selectedSpecialty) throw new ServiceError("Specialty not found.", 404, "SPECIALTY_NOT_FOUND");
    const [updated] = await tx
      .update(doctor)
      .set({ specialtyId })
      .where(eq(doctor.userId, userId))
      .returning();
    if (!updated) throw new ServiceError("Doctor not found.", 404, "DOCTOR_NOT_FOUND");
    await recordAudit(tx, {
      actorId: actor.userId,
      action: adminConfigActions.doctorSpecialtyChanged,
      targetType: "user",
      targetId: userId,
      metadata: { changedFields: ["specialtyId"] },
    });
    return updated;
  });
}
