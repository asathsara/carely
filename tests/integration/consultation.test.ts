import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { user } from "@/lib/db/schema/auth";
import { appointment } from "@/lib/db/schema/appointment";
import { doctor } from "@/lib/db/schema/doctor";
import { encounter } from "@/lib/db/schema/encounter";
import { queueEntry, type QueueEntry } from "@/lib/db/schema/queue-entry";
import { auditLog } from "@/lib/db/schema/audit-log";
import type { Database } from "@/lib/db/types";
import { createEncounter, createQueuedVisit, createUser } from "../helpers/factories";

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

describe.skipIf(!config.adminUrl)("Consultation opening (PostgreSQL)", () => {
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
});
