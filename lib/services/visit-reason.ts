import { and, asc, count, eq, sql } from "drizzle-orm";
import { adminConfigActions } from "@/lib/audit/actions/admin-config";
import { db } from "@/lib/db";
import { specialty } from "@/lib/db/schema/specialty";
import { visitReason } from "@/lib/db/schema/visit-reason";
import { appointment } from "@/lib/db/schema/appointment";
import { doctor } from "@/lib/db/schema/doctor";
import { user } from "@/lib/db/schema/auth";
import { assertActiveActor, type Actor } from "@/lib/services/access-policy";
import { recordAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/service-error";
import { getOpenDatesForDoctor } from "@/lib/services/booking";

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

export async function listPatientVisitReasons() {
  return db
    .select({ id: visitReason.id, name: visitReason.name, specialtyName: specialty.name })
    .from(visitReason)
    .innerJoin(specialty, eq(visitReason.specialtyId, specialty.id))
    .where(eq(visitReason.isActive, true))
    .orderBy(asc(visitReason.name));
}

export async function findDoctorsForReason(reasonId: string) {
  const [reason] = await db
    .select({ specialtyId: visitReason.specialtyId })
    .from(visitReason)
    .where(and(eq(visitReason.id, reasonId), eq(visitReason.isActive, true)))
    .limit(1);
  if (!reason) throw new ServiceError("Visit reason not found.", 404, "REASON_NOT_FOUND");

  const doctors = await db
    .select({
      id: doctor.id,
      name: user.name,
      specialtyName: specialty.name,
      consultationFee: doctor.consultationFee,
    })
    .from(doctor)
    .innerJoin(user, eq(doctor.userId, user.id))
    .innerJoin(specialty, eq(doctor.specialtyId, specialty.id))
    .where(
      and(
        eq(doctor.specialtyId, reason.specialtyId),
        eq(doctor.isActive, true),
        eq(user.role, "doctor"),
        sql`coalesce(${user.banned}, false) = false`
      )
    );

  const withDates = await Promise.all(
    doctors.map(async (doctor) => ({ doctor, dates: await getOpenDatesForDoctor(doctor.id) }))
  );
  return withDates
    .sort((left, right) => {
      const leftDate = left.dates.dates[0]?.date ?? "9999-12-31";
      const rightDate = right.dates.dates[0]?.date ?? "9999-12-31";
      return leftDate.localeCompare(rightDate) || left.doctor.name.localeCompare(right.doctor.name);
    })
    .map(({ doctor }) => doctor);
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
