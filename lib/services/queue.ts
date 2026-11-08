import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { queueActions } from "@/lib/audit/actions/queue";
import { appointment } from "@/lib/db/schema/appointment";
import { encounter } from "@/lib/db/schema/encounter";
import { queueEntry, type QueueEntry } from "@/lib/db/schema/queue-entry";
import type { DbTransaction } from "@/lib/db/types";
import { colomboNow } from "@/lib/clinic-time";
import {
  isAllowedQueueTransition,
  type CheckInAppointment,
  type TransitionQueueEntry,
} from "@/lib/schemas/queue";
import { assertActiveActor, isTreatingDoctor } from "./access-policy";
import { recordAudit } from "./audit";
import { getOrCreateEncounter } from "./encounter";
import { ServiceError } from "./service-error";

function assertUuid(id: string) {
  if (!z.uuid().safeParse(id).success) {
    throw new ServiceError("Invalid record identifier.", 400, "INVALID_ID");
  }
}

function assertReceptionist(role: string) {
  if (role !== "receptionist") {
    throw new ServiceError("Only reception staff can check in appointments.", 403, "FORBIDDEN");
  }
}

export const checkInAppointment: CheckInAppointment = async (input, tx) => {
  assertUuid(input.appointmentId);
  const run = async (transaction: DbTransaction): Promise<QueueEntry> => {
    await assertActiveActor(input.actor, transaction);
    assertReceptionist(input.actor.role);

    // Always hold the appointment lock first. This serializes cancellation and check-in.
    const [booking] = await transaction
      .select()
      .from(appointment)
      .where(eq(appointment.id, input.appointmentId))
      .for("update");
    if (!booking) {
      throw new ServiceError("Appointment not found.", 404, "NOT_FOUND");
    }
    if (booking.status !== "booked" || booking.appointmentDate !== colomboNow().date) {
      throw new ServiceError(
        "Only today's booked appointments can be checked in.",
        409,
        "APPOINTMENT_CLOSED"
      );
    }

    // The unique appointment_id is the idempotency key. The appointment lock means a
    // concurrent retry sees the same row; no arrival timestamp or token is rewritten.
    const [existing] = await transaction
      .select()
      .from(queueEntry)
      .where(eq(queueEntry.appointmentId, booking.id))
      .for("update");
    if (existing) {
      await getOrCreateEncounter(booking.id, input.actor, transaction);
      return existing;
    }

    const [created] = await transaction
      .insert(queueEntry)
      .values({ appointmentId: booking.id, status: "waiting" })
      .returning();

    // Check-in is the one workflow operation that creates the queue row before the
    // encounter helper can lock the encounter. The appointment lock remains held.
    await getOrCreateEncounter(booking.id, input.actor, transaction);
    await recordAudit(transaction, {
      actorId: input.actor.userId,
      action: queueActions.checkedIn,
      targetType: "queue_entry",
      targetId: created.id,
      metadata: { toStatus: "waiting" },
    });
    return created;
  };
  return tx ? run(tx) : db.transaction(run);
};

export const transitionQueueEntry: TransitionQueueEntry = async (input, tx) => {
  assertUuid(input.entryId);
  const run = async (transaction: DbTransaction): Promise<QueueEntry> => {
    await assertActiveActor(input.actor, transaction);
    if (!["nurse", "doctor"].includes(input.actor.role)) {
      throw new ServiceError("This queue transition is not allowed.", 403, "FORBIDDEN");
    }
    if (!isAllowedQueueTransition(input.from, input.to, input.actor.role)) {
      throw new ServiceError(
        "The queue entry cannot skip or reverse workflow states.",
        409,
        "INVALID_QUEUE_TRANSITION"
      );
    }

    // Resolve the parent, then lock appointment -> encounter before the conditional
    // queue update. Callers that already hold these locks reuse this transaction.
    const [reference] = await transaction
      .select({ appointmentId: queueEntry.appointmentId })
      .from(queueEntry)
      .where(eq(queueEntry.id, input.entryId))
      .limit(1);
    if (!reference) throw new ServiceError("Queue entry not found.", 404, "NOT_FOUND");

    const [booking] = await transaction
      .select()
      .from(appointment)
      .where(eq(appointment.id, reference.appointmentId))
      .for("update");
    if (
      !booking ||
      booking.status !== "booked" ||
      booking.appointmentDate !== colomboNow().date
    ) {
      throw new ServiceError("Queue entry not found.", 404, "NOT_FOUND");
    }
    const [visit] = await transaction
      .select({ id: encounter.id })
      .from(encounter)
      .where(eq(encounter.appointmentId, booking.id))
      .for("update");
    if (!visit) {
      throw new ServiceError(
        "Check in the appointment before changing its queue state.",
        409,
        "CHECK_IN_REQUIRED"
      );
    }
    if (
      input.actor.role === "doctor" &&
      !(await isTreatingDoctor(input.actor.userId, booking.id, transaction))
    ) {
      throw new ServiceError("Queue entry not found.", 404, "NOT_FOUND");
    }

    const values: Partial<typeof queueEntry.$inferInsert> = {
      status: input.to,
      ...(input.to === "with_doctor" ? { calledAt: new Date() } : {}),
    };
    const [updated] = await transaction
      .update(queueEntry)
      .set(values)
      .where(and(eq(queueEntry.id, input.entryId), eq(queueEntry.status, input.from)))
      .returning();
    if (!updated) {
      throw new ServiceError(
        "The queue entry has already changed state.",
        409,
        "QUEUE_STATE_CONFLICT"
      );
    }
    await recordAudit(transaction, {
      actorId: input.actor.userId,
      action: queueActions.statusChanged,
      targetType: "queue_entry",
      targetId: updated.id,
      metadata: { fromStatus: input.from, toStatus: input.to },
    });
    return updated;
  };
  return tx ? run(tx) : db.transaction(run);
};
