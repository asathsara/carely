import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { queueActions } from "@/lib/audit/actions/queue";
import { appointment } from "@/lib/db/schema/appointment";
import { doctor } from "@/lib/db/schema/doctor";
import { patient } from "@/lib/db/schema/patient";
import { user } from "@/lib/db/schema/auth";
import { encounter } from "@/lib/db/schema/encounter";
import { queueEntry, type QueueEntry } from "@/lib/db/schema/queue-entry";
import type { DbTransaction } from "@/lib/db/types";
import { colomboNow } from "@/lib/clinic-time";
import {
  isAllowedQueueTransition,
  type CheckInAppointment,
  type TransitionQueueEntry,
  type PatientQueueStatusResponse,
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
    throw new ServiceError(
      "Only reception staff can check in appointments.",
      403,
      "FORBIDDEN"
    );
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

    // The encounter helper needs the queue row; the appointment lock remains held.
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

    // Keep the shared lock order: appointment -> encounter -> queue.
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

export type StaffQueueEntry = {
  id: string;
  status: QueueEntry["status"];
  checkedInAt: Date;
  appointmentId: string;
  appointmentNo: number;
  doctorId: string;
  doctorName: string;
  patient: { id: string; patientNo: string; fullName: string };
};

export async function getStaffQueue(input: {
  doctorId: string;
  date: string;
  actor: { userId: string; role: string };
}) {
  assertUuid(input.doctorId);
  await assertActiveActor(input.actor);
  if (!["receptionist", "nurse", "doctor"].includes(input.actor.role)) {
    throw new ServiceError("Forbidden.", 403, "FORBIDDEN");
  }
  if (input.actor.role === "doctor") {
    const [owned] = await db
      .select({ id: doctor.id })
      .from(doctor)
      .where(eq(doctor.userId, input.actor.userId))
      .limit(1);
    if (!owned || owned.id !== input.doctorId) {
      throw new ServiceError("Queue not found.", 404, "NOT_FOUND");
    }
  }
  const rows = await db
    .select({
      id: queueEntry.id,
      status: queueEntry.status,
      checkedInAt: queueEntry.checkedInAt,
      appointmentId: appointment.id,
      appointmentNo: appointment.appointmentNo,
      doctorId: doctor.id,
      doctorName: user.name,
      patientId: patient.id,
      patientNo: patient.patientNo,
      patientName: patient.fullName,
    })
    .from(queueEntry)
    .innerJoin(appointment, eq(queueEntry.appointmentId, appointment.id))
    .innerJoin(doctor, eq(appointment.doctorId, doctor.id))
    .innerJoin(user, eq(doctor.userId, user.id))
    .innerJoin(patient, eq(appointment.patientId, patient.id))
    .where(
      and(
        eq(appointment.doctorId, input.doctorId),
        eq(appointment.appointmentDate, input.date),
        ne(appointment.status, "cancelled")
      )
    )
    .orderBy(asc(queueEntry.checkedInAt), asc(queueEntry.id));
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    checkedInAt: row.checkedInAt,
    appointmentId: row.appointmentId,
    appointmentNo: row.appointmentNo,
    doctorId: row.doctorId,
    doctorName: row.doctorName,
    patient: { id: row.patientId, patientNo: row.patientNo, fullName: row.patientName },
  }));
}

export async function getOwnQueueStatus(actor: {
  userId: string;
  role: string;
}): Promise<PatientQueueStatusResponse> {
  if (actor.role !== "patient") throw new ServiceError("Forbidden.", 403, "FORBIDDEN");
  // Use one snapshot for visit selection and position: a concurrent completion must
  // not turn a waiting entry into a misleading "complete" response.
  return db.transaction(
    async (tx) => {
      await assertActiveActor(actor, tx);
      const today = colomboNow().date;
      const [entry] = await tx
        .select({
          id: queueEntry.id,
          status: queueEntry.status,
          doctorId: appointment.doctorId,
          doctorName: user.name,
          appointmentId: appointment.id,
          appointmentNo: appointment.appointmentNo,
          date: appointment.appointmentDate,
          checkedInAt: queueEntry.checkedInAt,
        })
        .from(queueEntry)
        .innerJoin(appointment, eq(queueEntry.appointmentId, appointment.id))
        .innerJoin(patient, eq(appointment.patientId, patient.id))
        .innerJoin(doctor, eq(appointment.doctorId, doctor.id))
        .innerJoin(user, eq(doctor.userId, user.id))
        .where(
          and(
            eq(patient.userId, actor.userId),
            eq(appointment.appointmentDate, today),
            ne(appointment.status, "cancelled")
          )
        )
        .orderBy(
          asc(sql`case when ${queueEntry.status} = 'completed' then 1 else 0 end`),
          asc(queueEntry.checkedInAt),
          asc(queueEntry.id)
        )
        .limit(1);
      if (!entry) return { entry: null };
      let position: number | null = null;
      if (entry.status !== "completed") {
        const ahead = await tx
          .select({ id: queueEntry.id })
          .from(queueEntry)
          .innerJoin(appointment, eq(queueEntry.appointmentId, appointment.id))
          .where(
            and(
              eq(appointment.doctorId, entry.doctorId),
              eq(appointment.appointmentDate, today),
              ne(queueEntry.status, "completed"),
              ne(appointment.status, "cancelled")
            )
          )
          .orderBy(asc(queueEntry.checkedInAt), asc(queueEntry.id));
        const index = ahead.findIndex((row) => row.id === entry.id);
        if (index === -1)
          throw new ServiceError("Queue entry not found.", 404, "NOT_FOUND");
        position = index + 1;
      }
      return {
        entry: {
          status: entry.status,
          position,
          appointmentId: entry.appointmentId,
          doctorName: entry.doctorName,
          appointmentNo: entry.appointmentNo,
          date: entry.date,
        },
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" }
  );
}
