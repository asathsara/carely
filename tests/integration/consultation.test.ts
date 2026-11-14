import { and, eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { user } from "@/lib/db/schema/auth";
import { appointment } from "@/lib/db/schema/appointment";
import { doctor } from "@/lib/db/schema/doctor";
import { encounter } from "@/lib/db/schema/encounter";
import { queueEntry, type QueueEntry } from "@/lib/db/schema/queue-entry";
import { auditLog } from "@/lib/db/schema/audit-log";
import { clinicalNote } from "@/lib/db/schema/clinical-note";
import { prescription } from "@/lib/db/schema/prescription";
import type { Database } from "@/lib/db/types";
import {
  createAppointment,
  createQueueEntry,
  createEncounter,
  createQueuedVisit,
  createUser,
} from "../helpers/factories";

const config = vi.hoisted(() => ({
  adminUrl:
    process.env.FOUNDATION_TEST_DATABASE_URL ?? process.env.BOOKING_TEST_DATABASE_URL,
  databaseName:
    "carely_consultation_test_" + Date.now() + "_" + Math.random().toString(16).slice(2),
}));

vi.mock("@/lib/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");
  const url = new URL(config.adminUrl!);
  url.pathname = "/" + config.databaseName;
  const conn = postgres(url.toString(), { max: 8, prepare: false });
  return { db: drizzle(conn), conn };
});

describe.skipIf(!config.adminUrl)("Consultations (PostgreSQL)", () => {
  let admin: postgres.Sql;
  let connection: postgres.Sql;
  let database: Database;
  let consultation: typeof import("@/lib/services/consultation");

  beforeAll(async () => {
    admin = postgres(config.adminUrl!, { max: 1, connect_timeout: 5 });
    await admin`create database ${admin(config.databaseName)}`;
    const dbModule = await import("@/lib/db");
    connection = dbModule.conn;
    database = dbModule.db;
    await migrate(database, { migrationsFolder: "./drizzle" });
    consultation = await import("@/lib/services/consultation");
  }, 30_000);

  afterAll(async () => {
    await connection?.end();
    if (admin) {
      await admin`drop database if exists ${admin(config.databaseName)}`;
      await admin.end();
    }
  });

  async function readyVisit(status: QueueEntry["status"] = "intake_done") {
    const fixture = await createQueuedVisit(database);
    const visit = await createEncounter(database, {
      appointmentId: fixture.appointment.id,
    });
    await database
      .update(queueEntry)
      .set({ status })
      .where(eq(queueEntry.id, fixture.queue.id));
    return {
      ...fixture,
      visit,
      actor: { userId: fixture.doctorUser.id, role: "doctor" },
    };
  }

  async function openingEvents(encounterId: string) {
    return database
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entityId, encounterId),
          eq(auditLog.action, "consultation.opened")
        )
      );
  }

  async function activeVisit(withNote = true) {
    const fixture = await readyVisit();
    const opened = await consultation.openConsultation({
      entryId: fixture.queue.id,
      actor: fixture.actor,
    });
    if (withNote) {
      await database.insert(clinicalNote).values({
        encounterId: fixture.visit.id,
        authorId: fixture.actor.userId,
        content: "Private clinical note.",
      });
    }
    return { ...fixture, opened };
  }

  async function completionEvents(encounterId: string) {
    return database
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entityId, encounterId),
          eq(auditLog.action, "consultation.completed")
        )
      );
  }

  it("lists only the session doctor's visits today and reports the same-visit note prerequisite", async () => {
    const fixture = await readyVisit();
    const other = await readyVisit();
    for (const overrides of [
      { appointmentDate: "2099-01-01" },
      { appointmentDate: "2000-01-01" },
      { status: "cancelled" },
    ]) {
      const booking = await createAppointment(database, {
        doctorId: fixture.doctor.id,
        appointmentNo: 2,
        ...overrides,
      });
      await createQueueEntry(database, { appointmentId: booking.id });
      await createEncounter(database, { appointmentId: booking.id });
    }
    const entries = await consultation.getDoctorConsultationQueue(fixture.actor);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      queueEntryId: fixture.queue.id,
      encounterId: fixture.visit.id,
      hasClinicalNote: false,
    });
    expect(entries.some((entry) => entry.queueEntryId === other.queue.id)).toBe(false);
    await database
      .insert(clinicalNote)
      .values({
        encounterId: fixture.visit.id,
        authorId: fixture.actor.userId,
        content: "Private note content.",
      });
    const updated = await consultation.getDoctorConsultationQueue(fixture.actor);
    expect(updated[0].hasClinicalNote).toBe(true);
    expect(JSON.stringify(updated)).not.toContain("Private note content.");
  });

  it("opens after real nurse intake, recording called_at and both opening events", async () => {
    const fixture = await readyVisit("waiting");
    const nurse = await createUser(database, { role: "nurse" });
    const intake = await import("@/lib/services/intake");
    await intake.recordIntake({
      encounterId: fixture.visit.id,
      actor: { userId: nurse.id, role: "nurse" },
      intake: {
        vitals: { heartRate: 82 },
        complaint: "Initial complaint.",
        preliminaryNote: "Nursing observations.",
      },
    });
    const opened = await consultation.openConsultation({
      entryId: fixture.queue.id,
      actor: fixture.actor,
    });
    expect(opened).toMatchObject({
      encounterId: fixture.visit.id,
      queueEntryId: fixture.queue.id,
      status: "with_doctor",
    });
    expect(
      await database.select().from(queueEntry).where(eq(queueEntry.id, fixture.queue.id))
    ).toMatchObject([
      {
        status: "with_doctor",
        calledAt: new Date(opened.calledAt),
        checkedInAt: fixture.queue.checkedInAt,
      },
    ]);
    expect(
      await database.select().from(encounter).where(eq(encounter.id, fixture.visit.id))
    ).toMatchObject([
      { status: "in_progress", endedAt: null, startedAt: fixture.visit.startedAt },
    ]);
    expect(
      await database
        .select()
        .from(appointment)
        .where(eq(appointment.id, fixture.appointment.id))
    ).toMatchObject([
      { status: "booked", appointmentNo: fixture.appointment.appointmentNo },
    ]);
    expect(await openingEvents(fixture.visit.id)).toMatchObject([
      {
        userId: fixture.actor.userId,
        entityType: "encounter",
        metadata: { fromStatus: "intake_done", toStatus: "with_doctor" },
      },
    ]);
    const queueEvents = await database
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, fixture.queue.id));
    expect(queueEvents).toHaveLength(2);
    expect(queueEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "queue.status_changed",
          userId: fixture.actor.userId,
          metadata: { fromStatus: "intake_done", toStatus: "with_doctor" },
        }),
      ])
    );
  });

  it("allows one concurrent open and rejects retries without duplicate audit events", async () => {
    const fixture = await readyVisit();
    const input = { entryId: fixture.queue.id, actor: fixture.actor };
    const results = await Promise.allSettled([
      consultation.openConsultation(input),
      consultation.openConsultation(input),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const loser = results.find((result) => result.status === "rejected");
    expect(loser?.status === "rejected" ? loser.reason : undefined).toMatchObject({
      statusCode: 409,
    });
    await expect(consultation.openConsultation(input)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(await openingEvents(fixture.visit.id)).toHaveLength(1);
    expect(
      await database
        .select()
        .from(auditLog)
        .where(eq(auditLog.entityId, fixture.queue.id))
    ).toHaveLength(1);
  });

  it("denies another doctor and rechecks account and doctor-profile availability", async () => {
    const fixture = await readyVisit();
    const other = await readyVisit();
    await expect(
      consultation.openConsultation({ entryId: fixture.queue.id, actor: other.actor })
    ).rejects.toMatchObject({ statusCode: 404 });
    await database
      .update(doctor)
      .set({ isActive: false })
      .where(eq(doctor.id, fixture.doctor.id));
    await expect(
      consultation.openConsultation({ entryId: fixture.queue.id, actor: fixture.actor })
    ).rejects.toMatchObject({ statusCode: 404 });
    await database
      .update(doctor)
      .set({ isActive: true })
      .where(eq(doctor.id, fixture.doctor.id));
    await database
      .update(user)
      .set({ banned: true })
      .where(eq(user.id, fixture.actor.userId));
    await expect(
      consultation.openConsultation({ entryId: fixture.queue.id, actor: fixture.actor })
    ).rejects.toMatchObject({ statusCode: 403, code: "ACCOUNT_UNAVAILABLE" });
    await database
      .update(user)
      .set({ banned: false, role: "nurse" })
      .where(eq(user.id, fixture.actor.userId));
    await expect(
      consultation.openConsultation({ entryId: fixture.queue.id, actor: fixture.actor })
    ).rejects.toMatchObject({ statusCode: 403, code: "ACCOUNT_UNAVAILABLE" });
    expect(await openingEvents(fixture.visit.id)).toEqual([]);
    expect(
      await database.select().from(queueEntry).where(eq(queueEntry.id, fixture.queue.id))
    ).toMatchObject([{ status: "intake_done", calledAt: null }]);
  });

  it("rejects missing encounters, invalid phases and closed appointments without mutation", async () => {
    for (const status of ["waiting", "with_doctor", "completed"] as const) {
      const fixture = await readyVisit(status);
      await expect(
        consultation.openConsultation({ entryId: fixture.queue.id, actor: fixture.actor })
      ).rejects.toMatchObject({ statusCode: 409, code: "INVALID_WORKFLOW_STATE" });
      expect(await openingEvents(fixture.visit.id)).toEqual([]);
    }
    for (const patch of [
      { appointmentDate: "2000-01-01" },
      { appointmentDate: "2099-01-01" },
      { status: "completed" },
      { status: "cancelled" },
    ]) {
      const fixture = await readyVisit();
      await database
        .update(appointment)
        .set(patch)
        .where(eq(appointment.id, fixture.appointment.id));
      await expect(
        consultation.openConsultation({ entryId: fixture.queue.id, actor: fixture.actor })
      ).rejects.toMatchObject({ statusCode: patch.status === "cancelled" ? 404 : 409 });
      expect(await openingEvents(fixture.visit.id)).toEqual([]);
    }
    const fixture = await readyVisit();
    await database
      .update(encounter)
      .set({ status: "completed", endedAt: new Date() })
      .where(eq(encounter.id, fixture.visit.id));
    await expect(
      consultation.openConsultation({ entryId: fixture.queue.id, actor: fixture.actor })
    ).rejects.toMatchObject({ statusCode: 409, code: "ENCOUNTER_COMPLETED" });
    const missing = await createQueuedVisit(database);
    await database
      .update(queueEntry)
      .set({ status: "intake_done" })
      .where(eq(queueEntry.id, missing.queue.id));
    await expect(
      consultation.openConsultation({
        entryId: missing.queue.id,
        actor: { userId: missing.doctorUser.id, role: "doctor" },
      })
    ).rejects.toMatchObject({ statusCode: 409, code: "CHECK_IN_REQUIRED" });
    await expect(
      consultation.openConsultation({
        entryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        actor: fixture.actor,
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rolls back called_at, state and queue audit if the consultation audit insert fails", async () => {
    const fixture = await readyVisit();
    // Install the failure only inside this suite's isolated test database.
    await connection`
      CREATE FUNCTION fail_test_consultation_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.action = 'consultation.opened' THEN
          RAISE EXCEPTION 'Test consultation audit failure';
        END IF;
        RETURN NEW;
      END;
      $$
    `;
    try {
      await connection`
        CREATE TRIGGER test_consultation_audit_failure BEFORE INSERT ON audit_log
        FOR EACH ROW EXECUTE FUNCTION fail_test_consultation_audit()
      `;
      await expect(
        consultation.openConsultation({ entryId: fixture.queue.id, actor: fixture.actor })
      ).rejects.toThrow();
      expect(
        await database
          .select()
          .from(queueEntry)
          .where(eq(queueEntry.id, fixture.queue.id))
      ).toMatchObject([{ status: "intake_done", calledAt: null }]);
      expect(await openingEvents(fixture.visit.id)).toEqual([]);
      expect(
        await database
          .select()
          .from(auditLog)
          .where(eq(auditLog.entityId, fixture.queue.id))
      ).toEqual([]);
    } finally {
      await connection`DROP TRIGGER IF EXISTS test_consultation_audit_failure ON audit_log`;
      await connection`DROP FUNCTION fail_test_consultation_audit()`;
    }
    await expect(
      consultation.openConsultation({ entryId: fixture.queue.id, actor: fixture.actor })
    ).resolves.toMatchObject({ status: "with_doctor" });
  });

  it("completes the encounter and queue with a server timestamp and both audit events", async () => {
    const fixture = await activeVisit();
    const result = await consultation.completeConsultation({
      encounterId: fixture.visit.id,
      actor: fixture.actor,
    });
    expect(result).toMatchObject({
      encounterId: fixture.visit.id,
      queueEntryId: fixture.queue.id,
      status: "completed",
    });
    expect(
      await database.select().from(encounter).where(eq(encounter.id, fixture.visit.id))
    ).toMatchObject([
      {
        status: "completed",
        endedAt: new Date(result.endedAt),
        startedAt: fixture.visit.startedAt,
      },
    ]);
    expect(
      await database.select().from(queueEntry).where(eq(queueEntry.id, fixture.queue.id))
    ).toMatchObject([
      {
        status: "completed",
        checkedInAt: fixture.queue.checkedInAt,
        calledAt: new Date(fixture.opened.calledAt),
      },
    ]);
    expect(
      await database
        .select()
        .from(appointment)
        .where(eq(appointment.id, fixture.appointment.id))
    ).toMatchObject([
      { status: "booked", appointmentNo: fixture.appointment.appointmentNo },
    ]);
    expect(await completionEvents(fixture.visit.id)).toMatchObject([
      {
        userId: fixture.actor.userId,
        action: "consultation.completed",
        entityType: "encounter",
        metadata: { fromStatus: "with_doctor", toStatus: "completed" },
      },
    ]);
    const events = await database
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, fixture.queue.id));
    expect(events).toHaveLength(2);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "queue.status_changed",
          userId: fixture.actor.userId,
          metadata: { fromStatus: "with_doctor", toStatus: "completed" },
        }),
      ])
    );
  });

  it("requires a note for the same encounter and leaves a note-less visit open", async () => {
    const fixture = await activeVisit(false);
    await activeVisit(); // A note for a different encounter cannot satisfy completion.
    await expect(
      consultation.completeConsultation({
        encounterId: fixture.visit.id,
        actor: fixture.actor,
      })
    ).rejects.toMatchObject({ statusCode: 409, code: "CLINICAL_NOTE_REQUIRED" });
    expect(
      await database.select().from(encounter).where(eq(encounter.id, fixture.visit.id))
    ).toMatchObject([{ status: "in_progress", endedAt: null }]);
    expect(
      await database.select().from(queueEntry).where(eq(queueEntry.id, fixture.queue.id))
    ).toMatchObject([{ status: "with_doctor" }]);
    expect(await completionEvents(fixture.visit.id)).toEqual([]);
  });

  it("allows only one concurrent completion and rejects subsequent retries", async () => {
    const fixture = await activeVisit();
    const input = { encounterId: fixture.visit.id, actor: fixture.actor };
    const results = await Promise.allSettled([
      consultation.completeConsultation(input),
      consultation.completeConsultation(input),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const loser = results.find((result) => result.status === "rejected");
    expect(loser?.status === "rejected" ? loser.reason : undefined).toMatchObject({
      statusCode: 409,
      code: "ENCOUNTER_COMPLETED",
    });
    await expect(consultation.completeConsultation(input)).rejects.toMatchObject({
      statusCode: 409,
      code: "ENCOUNTER_COMPLETED",
    });
    expect(await completionEvents(fixture.visit.id)).toHaveLength(1);
    expect(
      await database
        .select()
        .from(auditLog)
        .where(eq(auditLog.entityId, fixture.queue.id))
    ).toHaveLength(2);
  });

  it("enforces completion ownership, live account checks, date and queue phase", async () => {
    const fixture = await activeVisit();
    const other = await readyVisit();
    await expect(
      consultation.completeConsultation({
        encounterId: fixture.visit.id,
        actor: other.actor,
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    await database
      .update(doctor)
      .set({ isActive: false })
      .where(eq(doctor.id, fixture.doctor.id));
    await expect(
      consultation.completeConsultation({
        encounterId: fixture.visit.id,
        actor: fixture.actor,
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    await database
      .update(doctor)
      .set({ isActive: true })
      .where(eq(doctor.id, fixture.doctor.id));
    await database
      .update(user)
      .set({ banned: true })
      .where(eq(user.id, fixture.actor.userId));
    await expect(
      consultation.completeConsultation({
        encounterId: fixture.visit.id,
        actor: fixture.actor,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "ACCOUNT_UNAVAILABLE" });
    await database
      .update(user)
      .set({ banned: false, role: "nurse" })
      .where(eq(user.id, fixture.actor.userId));
    await expect(
      consultation.completeConsultation({
        encounterId: fixture.visit.id,
        actor: fixture.actor,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "ACCOUNT_UNAVAILABLE" });

    for (const status of ["waiting", "intake_done", "completed"] as const) {
      const invalid = await readyVisit(status);
      await expect(
        consultation.completeConsultation({
          encounterId: invalid.visit.id,
          actor: invalid.actor,
        })
      ).rejects.toMatchObject({ statusCode: 409, code: "INVALID_WORKFLOW_STATE" });
    }
    for (const patch of [
      { appointmentDate: "2000-01-01" },
      { appointmentDate: "2099-01-01" },
      { status: "cancelled" },
      { status: "completed" },
    ]) {
      const invalid = await activeVisit();
      await database
        .update(appointment)
        .set(patch)
        .where(eq(appointment.id, invalid.appointment.id));
      await expect(
        consultation.completeConsultation({
          encounterId: invalid.visit.id,
          actor: invalid.actor,
        })
      ).rejects.toMatchObject({ statusCode: patch.status === "cancelled" ? 404 : 409 });
      expect(await completionEvents(invalid.visit.id)).toEqual([]);
    }
    await expect(
      consultation.completeConsultation({
        encounterId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        actor: other.actor,
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(await completionEvents(fixture.visit.id)).toEqual([]);
  });

  it("rolls back encounter, queue and audits when the completion audit insert fails", async () => {
    const fixture = await activeVisit();
    await connection`
      CREATE FUNCTION fail_test_completion_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.action = 'consultation.completed' THEN
          RAISE EXCEPTION 'Test completion audit failure';
        END IF;
        RETURN NEW;
      END;
      $$
    `;
    try {
      await connection`
        CREATE TRIGGER test_completion_audit_failure BEFORE INSERT ON audit_log
        FOR EACH ROW EXECUTE FUNCTION fail_test_completion_audit()
      `;
      await expect(
        consultation.completeConsultation({
          encounterId: fixture.visit.id,
          actor: fixture.actor,
        })
      ).rejects.toThrow();
      expect(
        await database.select().from(encounter).where(eq(encounter.id, fixture.visit.id))
      ).toMatchObject([{ status: "in_progress", endedAt: null }]);
      expect(
        await database
          .select()
          .from(queueEntry)
          .where(eq(queueEntry.id, fixture.queue.id))
      ).toMatchObject([
        { status: "with_doctor", calledAt: new Date(fixture.opened.calledAt) },
      ]);
      expect(await completionEvents(fixture.visit.id)).toEqual([]);
      expect(
        await database
          .select()
          .from(auditLog)
          .where(eq(auditLog.entityId, fixture.queue.id))
      ).toHaveLength(1);
    } finally {
      await connection`DROP TRIGGER IF EXISTS test_completion_audit_failure ON audit_log`;
      await connection`DROP FUNCTION fail_test_completion_audit()`;
    }
    await expect(
      consultation.completeConsultation({
        encounterId: fixture.visit.id,
        actor: fixture.actor,
      })
    ).resolves.toMatchObject({ status: "completed" });
  });

  it("rejects guarded note, intake and prescription writes after completion", async () => {
    const fixture = await activeVisit();
    const { assertEncounterWritable } = await import("@/lib/services/encounter");
    const nurse = await createUser(database, { role: "nurse" });
    await consultation.completeConsultation({
      encounterId: fixture.visit.id,
      actor: fixture.actor,
    });
    for (const actor of [fixture.actor, { userId: nurse.id, role: "nurse" }]) {
      await expect(
        database.transaction(async (tx) => {
          await assertEncounterWritable(fixture.visit.id, actor, tx);
          await tx.insert(clinicalNote).values({
            encounterId: fixture.visit.id,
            authorId: actor.userId,
            content: "Late note.",
          });
        })
      ).rejects.toMatchObject({ statusCode: 409, code: "ENCOUNTER_COMPLETED" });
    }
    await expect(
      database.transaction(async (tx) => {
        await assertEncounterWritable(fixture.visit.id, fixture.actor, tx);
        await tx
          .insert(prescription)
          .values({ encounterId: fixture.visit.id, doctorId: fixture.doctor.id });
      })
    ).rejects.toMatchObject({ statusCode: 409, code: "ENCOUNTER_COMPLETED" });
    expect(
      await database
        .select()
        .from(clinicalNote)
        .where(eq(clinicalNote.encounterId, fixture.visit.id))
    ).toHaveLength(1);
    expect(
      await database
        .select()
        .from(prescription)
        .where(eq(prescription.encounterId, fixture.visit.id))
    ).toEqual([]);
  });

  it("holds the clinical write lock until completion commits, then rejects a late writer", async () => {
    const fixture = await activeVisit();
    const { assertEncounterWritable } = await import("@/lib/services/encounter");
    const audit = await import("@/lib/services/audit");
    const original = audit.recordAudit;
    let signalLocked!: () => void;
    let release!: () => void;
    const locked = new Promise<void>((resolve) => {
      signalLocked = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = vi.spyOn(audit, "recordAudit").mockImplementation(async (tx, event) => {
      if (event.action === "consultation.completed") {
        signalLocked();
        await gate;
      }
      return original(tx, event);
    });
    const completing = consultation.completeConsultation({
      encounterId: fixture.visit.id,
      actor: fixture.actor,
    });
    void completing.catch(() => signalLocked());
    try {
      await locked;
      // A writer must block behind the completion transaction's appointment lock.
      await expect(
        database.transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL lock_timeout = '200ms'`);
          await assertEncounterWritable(fixture.visit.id, fixture.actor, tx);
          await tx.insert(clinicalNote).values({
            encounterId: fixture.visit.id,
            authorId: fixture.actor.userId,
            content: "Racing note.",
          });
        })
      ).rejects.toMatchObject({ cause: { code: "55P03" } });
    } finally {
      release();
      try {
        await completing;
      } finally {
        spy.mockRestore();
      }
    }
    await expect(
      database.transaction((tx) =>
        assertEncounterWritable(fixture.visit.id, fixture.actor, tx)
      )
    ).rejects.toMatchObject({ statusCode: 409, code: "ENCOUNTER_COMPLETED" });
    expect(
      await database
        .select()
        .from(clinicalNote)
        .where(eq(clinicalNote.encounterId, fixture.visit.id))
    ).toHaveLength(1);
  });
});
