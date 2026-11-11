import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { auditLog } from "@/lib/db/schema/audit-log";
import { encounter } from "@/lib/db/schema/encounter";
import { queueEntry } from "@/lib/db/schema/queue-entry";
import { appointment } from "@/lib/db/schema/appointment";
import { user } from "@/lib/db/schema/auth";
import {
  createAppointment,
  createDoctor,
  createUser,
  createPatient,
  createQueueEntry,
} from "../helpers/factories";
import type { Database } from "@/lib/db/types";

const config = vi.hoisted(() => ({
  adminUrl:
    process.env.FOUNDATION_TEST_DATABASE_URL ?? process.env.BOOKING_TEST_DATABASE_URL,
  databaseName:
    "carely_queue_test_" + Date.now() + "_" + Math.random().toString(16).slice(2),
}));

vi.mock("@/lib/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");
  const url = new URL(config.adminUrl!);
  url.pathname = "/" + config.databaseName;
  const conn = postgres(url.toString(), { max: 8, prepare: false });
  return { db: drizzle(conn), conn };
});

describe.skipIf(!config.adminUrl)("Queue check-in (PostgreSQL)", () => {
  let admin: postgres.Sql;
  let connection: postgres.Sql;
  let database: Database;
  let queue: typeof import("@/lib/services/queue");
  let receptionist: { userId: string; role: string };
  let nurse: { userId: string; role: string };

  beforeAll(async () => {
    admin = postgres(config.adminUrl!, { max: 1, connect_timeout: 5 });
    await admin`create database ${admin(config.databaseName)}`;
    const dbModule = await import("@/lib/db");
    connection = dbModule.conn;
    database = dbModule.db;
    await migrate(database, { migrationsFolder: "./drizzle" });
    queue = await import("@/lib/services/queue");
    const receptionUser = await createUser(database, { role: "receptionist" });
    const nurseUser = await createUser(database, { role: "nurse" });
    receptionist = { userId: receptionUser.id, role: receptionUser.role };
    nurse = { userId: nurseUser.id, role: nurseUser.role };
  }, 30_000);

  afterAll(async () => {
    await connection?.end();
    if (admin) {
      await admin`drop database if exists ${admin(config.databaseName)}`;
      await admin.end();
    }
  });

  it("checks in only valid appointments and returns the same entry on retry", async () => {
    const booking = await createAppointment(database);
    const first = await queue.checkInAppointment({
      appointmentId: booking.id,
      actor: receptionist,
    });
    const retried = await queue.checkInAppointment({
      appointmentId: booking.id,
      actor: receptionist,
    });
    expect(retried.id).toBe(first.id);
    expect(
      await database
        .select()
        .from(queueEntry)
        .where(eq(queueEntry.appointmentId, booking.id))
    ).toHaveLength(1);
    expect(
      await database
        .select()
        .from(encounter)
        .where(eq(encounter.appointmentId, booking.id))
    ).toHaveLength(1);
    expect(
      await database.select().from(auditLog).where(eq(auditLog.entityId, first.id))
    ).toMatchObject([{ action: "queue.checked_in", userId: receptionist.userId }]);

    const future = await createAppointment(database, { appointmentDate: "2099-01-01" });
    await expect(
      queue.checkInAppointment({ appointmentId: future.id, actor: receptionist })
    ).rejects.toMatchObject({ code: "APPOINTMENT_CLOSED" });
    const cancelled = await createAppointment(database, { status: "cancelled" });
    await expect(
      queue.checkInAppointment({ appointmentId: cancelled.id, actor: receptionist })
    ).rejects.toMatchObject({ code: "APPOINTMENT_CLOSED" });
    await expect(
      queue.checkInAppointment({ appointmentId: booking.id, actor: nurse })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("serializes concurrent check-in retries and cancellation in either lock order", async () => {
    const booking = await createAppointment(database);
    const bookingService = await import("@/lib/services/booking");
    const results = await Promise.allSettled([
      queue.checkInAppointment({ appointmentId: booking.id, actor: receptionist }),
      queue.checkInAppointment({ appointmentId: booking.id, actor: receptionist }),
      bookingService.cancelAppointment({
        appointmentId: booking.id,
        actor: receptionist,
      }),
    ]);
    const entries = await database
      .select()
      .from(queueEntry)
      .where(eq(queueEntry.appointmentId, booking.id));
    const [after] = await database
      .select()
      .from(appointment)
      .where(eq(appointment.id, booking.id));
    expect(entries.length).toBeLessThanOrEqual(1);
    expect(!(after.status === "cancelled" && entries.length > 0)).toBe(true);
    expect(
      results.filter((result) => result.status === "fulfilled").length
    ).toBeGreaterThan(0);
  });

  it("rejects cancellation after check-in and check-in after cancellation", async () => {
    const bookingService = await import("@/lib/services/booking");
    const checkedInFirst = await createAppointment(database);
    await queue.checkInAppointment({
      appointmentId: checkedInFirst.id,
      actor: receptionist,
    });
    await expect(
      bookingService.cancelAppointment({
        appointmentId: checkedInFirst.id,
        actor: receptionist,
      })
    ).resolves.toMatchObject({ success: false, code: "APPOINTMENT_CLOSED" });

    const cancelledFirst = await createAppointment(database);
    await expect(
      bookingService.cancelAppointment({
        appointmentId: cancelledFirst.id,
        actor: receptionist,
      })
    ).resolves.toEqual({ success: true });
    await expect(
      queue.checkInAppointment({ appointmentId: cancelledFirst.id, actor: receptionist })
    ).rejects.toMatchObject({ code: "APPOINTMENT_CLOSED" });
  });

  it("rolls back queue, encounter and audit writes with its caller transaction", async () => {
    const booking = await createAppointment(database);
    const auditsBefore = await database
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, receptionist.userId));
    await expect(
      database.transaction(async (tx) => {
        await queue.checkInAppointment(
          { appointmentId: booking.id, actor: receptionist },
          tx
        );
        throw new Error("simulate domain failure");
      })
    ).rejects.toThrow("simulate domain failure");
    expect(
      await database
        .select()
        .from(queueEntry)
        .where(eq(queueEntry.appointmentId, booking.id))
    ).toHaveLength(0);
    expect(
      await database
        .select()
        .from(encounter)
        .where(eq(encounter.appointmentId, booking.id))
    ).toHaveLength(0);
    expect(
      await database
        .select()
        .from(auditLog)
        .where(eq(auditLog.userId, receptionist.userId))
    ).toHaveLength(auditsBefore.length);
  });

  it("allows exactly one concurrent conditional queue transition", async () => {
    const booking = await createAppointment(database);
    const entry = await queue.checkInAppointment({
      appointmentId: booking.id,
      actor: receptionist,
    });
    const results = await Promise.allSettled([
      queue.transitionQueueEntry({
        entryId: entry.id,
        from: "waiting",
        to: "intake_done",
        actor: nurse,
      }),
      queue.transitionQueueEntry({
        entryId: entry.id,
        from: "waiting",
        to: "intake_done",
        actor: nurse,
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const failed = results.find((result) => result.status === "rejected");
    expect(failed).toMatchObject({
      reason: { code: "QUEUE_STATE_CONFLICT", statusCode: 409 },
    });
  });

  it("rejects skipped transitions and a doctor who does not own the appointment", async () => {
    const booking = await createAppointment(database);
    const entry = await queue.checkInAppointment({
      appointmentId: booking.id,
      actor: receptionist,
    });
    const outsider = await createDoctor(database);
    const [outsiderUser] = await database
      .select()
      .from(user)
      .where(eq(user.id, outsider.userId));
    await expect(
      queue.transitionQueueEntry({
        entryId: entry.id,
        from: "waiting",
        to: "with_doctor",
        actor: { userId: outsiderUser.id, role: "doctor" },
      })
    ).rejects.toMatchObject({ code: "INVALID_QUEUE_TRANSITION" });
    await queue.transitionQueueEntry({
      entryId: entry.id,
      from: "waiting",
      to: "intake_done",
      actor: nurse,
    });
    await expect(
      queue.transitionQueueEntry({
        entryId: entry.id,
        from: "intake_done",
        to: "with_doctor",
        actor: { userId: outsiderUser.id, role: "doctor" },
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("selects an active visit after an earlier completed visit and returns its matching doctor/token", async () => {
    const owner = await createUser(database);
    const ownPatient = await createPatient(database, { userId: owner.id });
    const earlier = await createAppointment(database, { patientId: ownPatient.id });
    const active = await createAppointment(database, { patientId: ownPatient.id });
    const otherPatient = await createPatient(database, {
      fullName: "Private Other Patient",
    });
    const aheadBooking = await createAppointment(database, {
      doctorId: active.doctorId,
      patientId: otherPatient.id,
      appointmentNo: 2,
    });
    const completedAhead = await createAppointment(database, {
      doctorId: active.doctorId,
      appointmentNo: 3,
    });
    const now = Date.now();
    await createQueueEntry(database, {
      appointmentId: earlier.id,
      status: "completed",
      checkedInAt: new Date(now - 90_000),
    });
    await createQueueEntry(database, {
      appointmentId: completedAhead.id,
      status: "completed",
      checkedInAt: new Date(now - 60_000),
    });
    await createQueueEntry(database, {
      appointmentId: aheadBooking.id,
      checkedInAt: new Date(now - 30_000),
    });
    const activeEntry = await createQueueEntry(database, {
      appointmentId: active.id,
      checkedInAt: new Date(now - 10_000),
    });
    const result = await queue.getOwnQueueStatus({ userId: owner.id, role: "patient" });
    expect(result).toMatchObject({
      entry: {
        appointmentId: active.id,
        appointmentNo: active.appointmentNo,
        date: active.appointmentDate,
        status: "waiting",
        position: 2,
      },
    });
    expect(JSON.stringify(result)).not.toContain(otherPatient.fullName);
    expect(JSON.stringify(result)).not.toContain(otherPatient.id);
    await database
      .update(queueEntry)
      .set({ status: "completed" })
      .where(eq(queueEntry.id, activeEntry.id));
    expect(
      await queue.getOwnQueueStatus({ userId: owner.id, role: "patient" })
    ).toMatchObject({ entry: { status: "completed", position: null } });
    const outsider = await createUser(database);
    expect(
      await queue.getOwnQueueStatus({ userId: outsider.id, role: "patient" })
    ).toEqual({ entry: null });
  });

  it("persists only the supplied contact field and audits field names without losing other details", async () => {
    const owner = await createUser(database);
    const ownPatient = await createPatient(database, {
      userId: owner.id,
      fullName: "Stored patient",
      gender: "Other",
      phone: "0771111111",
      address: "Preserved address",
      emergencyContactName: "Preserved contact",
      emergencyContactPhone: "0772222222",
    });
    const patientService = await import("@/lib/services/patient");
    const { patientProfileUpdateSchema, receptionistPatientUpdateSchema } =
      await import("@/lib/schemas/patient-update");
    const actor = { userId: owner.id, role: "patient" };
    const updated = await patientService.updateOwnPatientProfile(
      patientProfileUpdateSchema.parse({ phone: "0773333333" }),
      actor
    );
    expect(updated).toMatchObject({
      phone: "0773333333",
      address: "Preserved address",
      emergencyContactName: "Preserved contact",
      emergencyContactPhone: "0772222222",
    });
    const events = await database
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, ownPatient.id));
    expect(events).toHaveLength(1);
    expect(events[0].metadata).toEqual({ changedFields: ["phone"] });
    expect(JSON.stringify(events[0].metadata)).not.toContain("0773333333");
    const profile = await patientService.getOwnPatientProfile(actor);
    expect(profile).toMatchObject({
      patientNo: ownPatient.patientNo,
      email: owner.email,
      phone: "0773333333",
      emergencyContactPhone: "0772222222",
    });
    const corrected = await patientService.updatePatientByReceptionist(
      ownPatient.id,
      receptionistPatientUpdateSchema.parse({ fullName: "Corrected name" }),
      receptionist
    );
    expect(corrected).toMatchObject({
      fullName: "Corrected name",
      gender: "Other",
      phone: "0773333333",
      address: "Preserved address",
      emergencyContactPhone: "0772222222",
    });
    const cleared = await patientService.updateOwnPatientProfile(
      patientProfileUpdateSchema.parse({ emergencyContactPhone: null }),
      actor
    );
    expect(cleared).toMatchObject({
      emergencyContactPhone: null,
      address: "Preserved address",
      phone: "0773333333",
    });
  });
});
