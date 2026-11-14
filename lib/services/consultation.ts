import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointment } from "@/lib/db/schema/appointment";
import { encounter } from "@/lib/db/schema/encounter";
import { queueEntry } from "@/lib/db/schema/queue-entry";
import { consultationActions } from "@/lib/audit/actions/consultation";
import { colomboNow } from "@/lib/clinic-time";
import {
  openConsultationParamsSchema,
  type OpenedConsultation,
} from "@/lib/schemas/consultation";
import { assertActiveActor, isTreatingDoctor, type Actor } from "./access-policy";
import { recordAudit } from "./audit";
import { transitionQueueEntry } from "./queue";
import { ServiceError } from "./service-error";

export async function openConsultation(input: {
  entryId: string;
  actor: Actor;
}): Promise<OpenedConsultation> {
  if (input.actor.role !== "doctor") {
    throw new ServiceError("Only doctors can open consultations.", 403, "FORBIDDEN");
  }
  if (!openConsultationParamsSchema.safeParse({ entryId: input.entryId }).success) {
    throw new ServiceError("Invalid queue entry identifier.", 400, "INVALID_ID");
  }

  return db.transaction(async (tx) => {
    await assertActiveActor(input.actor, tx);
    const [reference] = await tx
      .select({ appointmentId: queueEntry.appointmentId })
      .from(queueEntry)
      .where(eq(queueEntry.id, input.entryId))
      .limit(1);
    if (!reference) throw new ServiceError("Queue entry not found.", 404, "NOT_FOUND");

    // Resolve the parent without locking the queue, then lock appointment -> encounter -> queue.
    const [booking] = await tx
      .select()
      .from(appointment)
      .where(eq(appointment.id, reference.appointmentId))
      .for("update");
    if (!booking || !(await isTreatingDoctor(input.actor.userId, booking.id, tx))) {
      throw new ServiceError("Queue entry not found.", 404, "NOT_FOUND");
    }
    if (booking.status !== "booked" || booking.appointmentDate !== colomboNow().date) {
      throw new ServiceError(
        "Only today's booked appointments can open a consultation.",
        409,
        "APPOINTMENT_CLOSED"
      );
    }
    const [visit] = await tx
      .select()
      .from(encounter)
      .where(eq(encounter.appointmentId, booking.id))
      .for("update");
    if (!visit) {
      throw new ServiceError(
        "The checked-in encounter is missing.",
        409,
        "CHECK_IN_REQUIRED"
      );
    }
    if (visit.status === "completed" || visit.endedAt !== null) {
      throw new ServiceError("The encounter is completed.", 409, "ENCOUNTER_COMPLETED");
    }
    const [entry] = await tx
      .select({ id: queueEntry.id, status: queueEntry.status })
      .from(queueEntry)
      .where(eq(queueEntry.id, input.entryId))
      .for("update");
    if (!entry) throw new ServiceError("Queue entry not found.", 404, "NOT_FOUND");
    if (entry.status !== "intake_done") {
      throw new ServiceError(
        "Complete intake before opening a consultation; an opened visit cannot be reopened.",
        409,
        "INVALID_WORKFLOW_STATE"
      );
    }

    // Opening must check intake_done directly: assertEncounterWritable expects with_doctor.
    const opened = await transitionQueueEntry(
      { entryId: entry.id, from: "intake_done", to: "with_doctor", actor: input.actor },
      tx
    );
    if (!opened.calledAt) throw new Error("Consultation opening timestamp is missing.");
    await recordAudit(tx, {
      actorId: input.actor.userId,
      action: consultationActions.opened,
      targetType: "encounter",
      targetId: visit.id,
      metadata: { fromStatus: "intake_done", toStatus: "with_doctor" },
    });
    return {
      encounterId: visit.id,
      queueEntryId: opened.id,
      status: "with_doctor",
      calledAt: opened.calledAt.toISOString(),
    };
  });
}
