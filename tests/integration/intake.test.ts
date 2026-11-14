import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { user } from "@/lib/db/schema/auth";
import { appointment } from "@/lib/db/schema/appointment";
import { queueEntry } from "@/lib/db/schema/queue-entry";
import { vitals } from "@/lib/db/schema/vitals";
import { preliminaryNote } from "@/lib/db/schema/preliminary-note";
import { auditLog } from "@/lib/db/schema/audit-log";
import type { Database } from "@/lib/db/types";
import type { Actor } from "@/lib/services/access-policy";
import type { RecordIntakeInput } from "@/lib/schemas/intake";
import {
  createAppointment,
  createEncounter,
  createQueueEntry,
  createUser,
} from "../helpers/factories";

const config = vi.hoisted(() => ({
  adminUrl:
    process.env.FOUNDATION_TEST_DATABASE_URL ?? process.env.BOOKING_TEST_DATABASE_URL,
  databaseName:
    "carely_intake_test_" + Date.now() + "_" + Math.random().toString(16).slice(2),
}));

vi.mock("@/lib/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");
  const url = new URL(config.adminUrl!);
  url.pathname = "/" + config.databaseName;
  const conn = postgres(url.toString(), { max: 8, prepare: false });
  return { db: drizzle(conn), conn };
});

describe.skipIf(!config.adminUrl)("Nurse intake (PostgreSQL)", () => {
  let admin: postgres.Sql;
  let connection: postgres.Sql;
  let database: Database;
  let intake: typeof import("@/lib/services/intake");
  let nurse: Actor;
  const intakeInput: RecordIntakeInput = {
    vitals: {
      bpSystolic: 128,
      bpDiastolic: 82,
      heartRate: 82,
      respiratoryRate: 18,
      temperatureC: 36.9,
      spo2: 97,
      weightKg: 68.3,
      heightCm: 170.5,
      additional: { glucose: 5.4, fasting: false },
    },
    complaint: "Private initial complaint.",
    preliminaryNote: "Private preliminary observations.",
  };

  async function waitingVisit() {
    const booking = await createAppointment(database, { appointmentNo: 9 });
    const entry = await createQueueEntry(database, { appointmentId: booking.id });
    const visit = await createEncounter(database, { appointmentId: booking.id });
    return { booking, entry, visit };
  }

  async function savedRecords(encounterId: string) {
    const [measurements, notes, events] = await Promise.all([
      database.select().from(vitals).where(eq(vitals.encounterId, encounterId)),
      database
        .select()
        .from(preliminaryNote)
        .where(eq(preliminaryNote.encounterId, encounterId)),
      database
        .select()
        .from(auditLog)
        .where(
          and(eq(auditLog.entityId, encounterId), eq(auditLog.action, "intake.recorded"))
        ),
    ]);
    return { measurements, notes, events };
  }

  beforeAll(async () => {
    admin = postgres(config.adminUrl!, { max: 1, connect_timeout: 5 });
    await admin`create database ${admin(config.databaseName)}`;
    const dbModule = await import("@/lib/db");
    connection = dbModule.conn;
    database = dbModule.db;
    await migrate(database, { migrationsFolder: "./drizzle" });
    intake = await import("@/lib/services/intake");
    const nurseUser = await createUser(database, { role: "nurse" });
    nurse = { userId: nurseUser.id, role: nurseUser.role };
  }, 30_000);

  afterAll(async () => {
    await connection?.end();
    if (admin) {
      await admin`drop database if exists ${admin(config.databaseName)}`;
      await admin.end();
    }
  });

  it("returns an empty queue before check-in", async () => {
    await createAppointment(database);
    expect(await intake.getNurseQueue(nurse)).toEqual([]);
  });

  it("lists only today's waiting writable visits across doctors in stable order", async () => {
    const checkedInAt = new Date();
    // Equal timestamps exercise the ID tie-breaker; appointment numbers stay unchanged.
    const visits = [];
    for (const [index, id] of [
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111",
    ].entries()) {
      const booking = await createAppointment(database, { appointmentNo: index + 3 });
      const entry = await createQueueEntry(database, {
        id,
        appointmentId: booking.id,
        checkedInAt,
      });
      const visit = await createEncounter(database, { appointmentId: booking.id });
      visits.push({ booking, entry, visit });
    }
    const earlier = await createAppointment(database);
    const earlierEntry = await createQueueEntry(database, {
      appointmentId: earlier.id,
      checkedInAt: new Date(checkedInAt.getTime() - 60_000),
    });
    await createEncounter(database, { appointmentId: earlier.id });

    for (const overrides of [
      { appointmentDate: "2000-01-01" },
      { appointmentDate: "2099-01-01" },
      { status: "cancelled" },
      { status: "completed" },
    ]) {
      const booking = await createAppointment(database, overrides);
      await createQueueEntry(database, { appointmentId: booking.id });
      await createEncounter(database, { appointmentId: booking.id });
    }
    for (const status of ["intake_done", "with_doctor", "completed"] as const) {
      const booking = await createAppointment(database);
      await createQueueEntry(database, { appointmentId: booking.id, status });
      await createEncounter(database, { appointmentId: booking.id });
    }
    const missingEncounter = await createAppointment(database);
    await createQueueEntry(database, { appointmentId: missingEncounter.id });
    const completedVisit = await createAppointment(database);
    await createQueueEntry(database, { appointmentId: completedVisit.id });
    await createEncounter(database, {
      appointmentId: completedVisit.id,
      status: "completed",
      endedAt: new Date(),
    });

    const entries = await intake.getNurseQueue(nurse);
    expect(entries.map((entry) => entry.id)).toEqual([
      earlierEntry.id,
      visits[1].entry.id,
      visits[0].entry.id,
    ]);
    expect(entries[1]).toMatchObject({
      encounterId: visits[1].visit.id,
      appointmentId: visits[1].booking.id,
      appointmentNo: 4,
      doctorId: visits[1].booking.doctorId,
      status: "waiting",
      checkedInAt: checkedInAt.toISOString(),
      patient: { id: visits[1].booking.patientId },
    });
    expect(Object.keys(entries[1].patient).sort()).toEqual([
      "fullName",
      "id",
      "patientNo",
    ]);
    expect(entries[1]).not.toHaveProperty("notes");
    expect(entries[1]).not.toHaveProperty("vitals");
    expect(entries[1]).not.toHaveProperty("prescriptions");
  });

  it("rejects non-nurses and stale nurse sessions after deactivation or role change", async () => {
    for (const role of ["patient", "receptionist", "doctor", "pharmacist", "admin"]) {
      const caller = await createUser(database, { role });
      await expect(
        intake.getNurseQueue({ userId: caller.id, role })
      ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    }
    const caller = await createUser(database, { role: "nurse" });
    const actor = { userId: caller.id, role: "nurse" };
    await database.update(user).set({ banned: true }).where(eq(user.id, caller.id));
    await expect(intake.getNurseQueue(actor)).rejects.toMatchObject({
      statusCode: 403,
      code: "ACCOUNT_UNAVAILABLE",
    });
    await database
      .update(user)
      .set({ banned: false, role: "doctor" })
      .where(eq(user.id, caller.id));
    await expect(intake.getNurseQueue(actor)).rejects.toMatchObject({
      statusCode: 403,
      code: "ACCOUNT_UNAVAILABLE",
    });
  });

  it("persists authored intake and both audit events with the handoff, preserving tokens", async () => {
    const { booking, entry, visit } = await waitingVisit();
    const result = await intake.recordIntake({
      encounterId: visit.id,
      intake: intakeInput,
      actor: nurse,
    });
    const saved = await savedRecords(visit.id);
    expect(saved.measurements).toHaveLength(1);
    expect(saved.measurements[0]).toMatchObject({
      id: result.vitalsId,
      encounterId: visit.id,
      recordedBy: nurse.userId,
      bpSystolic: 128,
      bpDiastolic: 82,
      temperatureC: "36.9",
      weightKg: "68.3",
      heightCm: "170.5",
      additional: intakeInput.vitals.additional,
      recordedAt: new Date(result.recordedAt),
    });
    expect(saved.notes).toHaveLength(1);
    expect(saved.notes[0]).toMatchObject({
      id: result.preliminaryNoteId,
      encounterId: visit.id,
      authorId: nurse.userId,
      content: `Initial complaint:\n${intakeInput.complaint}\n\nPreliminary note:\n${intakeInput.preliminaryNote}`,
      createdAt: new Date(result.recordedAt),
    });
    expect(saved.events).toMatchObject([
      {
        userId: nurse.userId,
        action: "intake.recorded",
        entityType: "encounter",
        entityId: visit.id,
        metadata: {},
      },
    ]);
    expect(
      await database.select().from(queueEntry).where(eq(queueEntry.id, entry.id))
    ).toMatchObject([{ status: "intake_done", checkedInAt: entry.checkedInAt }]);
    expect(
      await database.select().from(auditLog).where(eq(auditLog.entityId, entry.id))
    ).toMatchObject([
      {
        action: "queue.status_changed",
        metadata: { fromStatus: "waiting", toStatus: "intake_done" },
      },
    ]);
    expect(
      await database.select().from(appointment).where(eq(appointment.id, booking.id))
    ).toMatchObject([{ appointmentNo: 9, status: "booked" }]);
    expect((await intake.getNurseQueue(nurse)).some((item) => item.id === entry.id)).toBe(
      false
    );

    await expect(
      intake.recordIntake({ encounterId: visit.id, intake: intakeInput, actor: nurse })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await savedRecords(visit.id)).measurements).toHaveLength(1);
  });

  it("allows only one of two concurrent intake submissions", async () => {
    const { visit, entry } = await waitingVisit();
    const other = await createUser(database, { role: "nurse" });
    const calls = [nurse, { userId: other.id, role: other.role }].map((actor) =>
      intake.recordIntake({ encounterId: visit.id, intake: intakeInput, actor })
    );
    const results = await Promise.allSettled(calls);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const loser = results.find((result) => result.status === "rejected");
    expect(loser?.status === "rejected" ? loser.reason : undefined).toMatchObject({
      statusCode: 409,
    });
    const saved = await savedRecords(visit.id);
    expect(saved.measurements).toHaveLength(1);
    expect(saved.notes).toHaveLength(1);
    expect(saved.events).toHaveLength(1);
    expect(saved.notes[0].authorId).toBe(saved.measurements[0].recordedBy);
    expect(saved.events[0].userId).toBe(saved.measurements[0].recordedBy);
    expect(
      await database.select().from(queueEntry).where(eq(queueEntry.id, entry.id))
    ).toMatchObject([{ status: "intake_done" }]);
  });

  it("rejects unknown, closed, unchecked-in and non-waiting encounters without writing", async () => {
    await expect(
      intake.recordIntake({
        encounterId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        intake: intakeInput,
        actor: nurse,
      })
    ).rejects.toMatchObject({ statusCode: 404 });

    for (const status of ["intake_done", "with_doctor", "completed"] as const) {
      const { visit, entry } = await waitingVisit();
      await database
        .update(queueEntry)
        .set({ status })
        .where(eq(queueEntry.id, entry.id));
      await expect(
        intake.recordIntake({ encounterId: visit.id, intake: intakeInput, actor: nurse })
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(await savedRecords(visit.id)).toEqual({
        measurements: [],
        notes: [],
        events: [],
      });
    }
    for (const overrides of [
      { status: "cancelled" },
      { appointmentDate: "2000-01-01" },
      { appointmentDate: "2099-01-01" },
    ]) {
      const { visit, booking } = await waitingVisit();
      await database
        .update(appointment)
        .set(overrides)
        .where(eq(appointment.id, booking.id));
      await expect(
        intake.recordIntake({ encounterId: visit.id, intake: intakeInput, actor: nurse })
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(await savedRecords(visit.id)).toEqual({
        measurements: [],
        notes: [],
        events: [],
      });
    }
    const booking = await createAppointment(database);
    const visit = await createEncounter(database, { appointmentId: booking.id });
    await expect(
      intake.recordIntake({ encounterId: visit.id, intake: intakeInput, actor: nurse })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await savedRecords(visit.id)).toEqual({
      measurements: [],
      notes: [],
      events: [],
    });

    const completed = await createEncounter(database, {
      status: "completed",
      endedAt: new Date(),
    });
    await expect(
      intake.recordIntake({
        encounterId: completed.id,
        intake: intakeInput,
        actor: nurse,
      })
    ).rejects.toMatchObject({ statusCode: 409, code: "ENCOUNTER_COMPLETED" });
    expect(await savedRecords(completed.id)).toEqual({
      measurements: [],
      notes: [],
      events: [],
    });
  });

  it("rejects deactivated nurses, stale roles and invalid values at the service boundary", async () => {
    const { visit } = await waitingVisit();
    const unavailable = await createUser(database, { role: "nurse", banned: true });
    await expect(
      intake.recordIntake({
        encounterId: visit.id,
        intake: intakeInput,
        actor: { userId: unavailable.id, role: "nurse" },
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "ACCOUNT_UNAVAILABLE" });
    const other = await createUser(database, { role: "doctor" });
    await expect(
      intake.recordIntake({
        encounterId: visit.id,
        intake: intakeInput,
        actor: { userId: other.id, role: "nurse" },
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "ACCOUNT_UNAVAILABLE" });
    await expect(
      intake.recordIntake({
        encounterId: visit.id,
        intake: { ...intakeInput, vitals: { spo2: 101 } },
        actor: nurse,
      })
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_INTAKE" });
    expect(await savedRecords(visit.id)).toEqual({
      measurements: [],
      notes: [],
      events: [],
    });
  });

  it("provides only today's own save confirmation after handoff", async () => {
    const { visit, booking } = await waitingVisit();
    await intake.recordIntake({
      encounterId: visit.id,
      intake: intakeInput,
      actor: nurse,
    });
    const receipt = await intake.getNurseIntakeReceipt(visit.id, nurse);
    expect(Object.keys(receipt).sort()).toEqual(["encounterId", "recordedAt"]);
    expect(receipt.encounterId).toBe(visit.id);
    const other = await createUser(database, { role: "nurse" });
    await expect(
      intake.getNurseIntakeReceipt(visit.id, { userId: other.id, role: "nurse" })
    ).rejects.toMatchObject({ statusCode: 404 });
    await database
      .update(appointment)
      .set({ appointmentDate: "2000-01-01" })
      .where(eq(appointment.id, booking.id));
    await expect(intake.getNurseIntakeReceipt(visit.id, nurse)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("rolls back records, handoff and queue audit when the intake audit insert fails", async () => {
    const { visit, entry } = await waitingVisit();
    // Fault injection is installed only in this suite's isolated database.
    await connection`
      CREATE FUNCTION fail_test_intake_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.action = 'intake.recorded' THEN
          RAISE EXCEPTION 'Test intake audit failure';
        END IF;
        RETURN NEW;
      END;
      $$
    `;
    try {
      await connection`
        CREATE TRIGGER test_intake_audit_failure BEFORE INSERT ON audit_log
        FOR EACH ROW EXECUTE FUNCTION fail_test_intake_audit()
      `;
      await expect(
        intake.recordIntake({ encounterId: visit.id, intake: intakeInput, actor: nurse })
      ).rejects.toThrow();
      expect(await savedRecords(visit.id)).toEqual({
        measurements: [],
        notes: [],
        events: [],
      });
      expect(
        await database.select().from(queueEntry).where(eq(queueEntry.id, entry.id))
      ).toMatchObject([{ status: "waiting" }]);
      expect(
        await database.select().from(auditLog).where(eq(auditLog.entityId, entry.id))
      ).toEqual([]);
    } finally {
      await connection`DROP TRIGGER IF EXISTS test_intake_audit_failure ON audit_log`;
      await connection`DROP FUNCTION fail_test_intake_audit()`;
    }
    // A clean retry succeeds once the injected failure is removed.
    await expect(
      intake.recordIntake({ encounterId: visit.id, intake: intakeInput, actor: nurse })
    ).resolves.toMatchObject({ status: "intake_done" });
  });
});
