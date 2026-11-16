import { and, asc, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { auditLog } from "@/lib/db/schema/audit-log";
import { clinicalNote } from "@/lib/db/schema/clinical-note";
import { encounter } from "@/lib/db/schema/encounter";
import { queueEntry } from "@/lib/db/schema/queue-entry";
import type { Database } from "@/lib/db/types";
import { createEncounter, createQueuedVisit } from "../helpers/factories";

const config = vi.hoisted(() => ({
  adminUrl:
    process.env.FOUNDATION_TEST_DATABASE_URL ?? process.env.BOOKING_TEST_DATABASE_URL,
  databaseName:
    "carely_clinical_notes_test_" +
    Date.now() +
    "_" +
    Math.random().toString(16).slice(2),
}));

vi.mock("@/lib/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");
  const url = new URL(config.adminUrl!);
  url.pathname = "/" + config.databaseName;
  const conn = postgres(url.toString(), { max: 8, prepare: false });
  return { db: drizzle(conn), conn };
});

describe.skipIf(!config.adminUrl)("Clinical notes (PostgreSQL)", () => {
  let admin: postgres.Sql;
  let connection: postgres.Sql;
  let database: Database;
  let consultation: typeof import("@/lib/services/consultation");
  let notes: typeof import("@/lib/services/clinical-notes");

  beforeAll(async () => {
    admin = postgres(config.adminUrl!, { max: 1, connect_timeout: 5 });
    await admin`create database ${admin(config.databaseName)}`;
    const dbModule = await import("@/lib/db");
    connection = dbModule.conn;
    database = dbModule.db;
    await migrate(database, { migrationsFolder: "./drizzle" });
    consultation = await import("@/lib/services/consultation");
    notes = await import("@/lib/services/clinical-notes");
  }, 30_000);

  afterAll(async () => {
    await connection?.end();
    if (admin) {
      await admin`drop database if exists ${admin(config.databaseName)}`;
      await admin.end();
    }
  });

  async function activeVisit() {
    const fixture = await createQueuedVisit(database);
    const visit = await createEncounter(database, {
      appointmentId: fixture.appointment.id,
    });
    await database
      .update(queueEntry)
      .set({ status: "intake_done" })
      .where(eq(queueEntry.id, fixture.queue.id));
    await consultation.openConsultation({
      entryId: fixture.queue.id,
      actor: { userId: fixture.doctorUser.id, role: "doctor" },
    });
    return {
      ...fixture,
      visit,
      actor: { userId: fixture.doctorUser.id, role: "doctor" },
    };
  }

  async function noteEvents(noteId: string) {
    return database
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entityId, noteId),
          eq(auditLog.entityType, "clinical_note"),
          eq(auditLog.action, "clinical_note.created")
        )
      );
  }

  it("creates valid append-only notes, audits them, and reads them in order", async () => {
    const fixture = await activeVisit();
    const first = await notes.createClinicalNote({
      encounterId: fixture.visit.id,
      actor: fixture.actor,
      note: { content: "First clinical note." },
    });
    const second = await notes.createClinicalNote({
      encounterId: fixture.visit.id,
      actor: fixture.actor,
      note: { content: "Second clinical note." },
    });

    expect(await noteEvents(first.id)).toMatchObject([
      {
        userId: fixture.actor.userId,
        action: "clinical_note.created",
        entityType: "clinical_note",
        metadata: {},
      },
    ]);
    await expect(
      notes.getClinicalNotes({ encounterId: fixture.visit.id, actor: fixture.actor })
    ).resolves.toEqual([
      expect.objectContaining({ id: first.id, content: "First clinical note." }),
      expect.objectContaining({ id: second.id, content: "Second clinical note." }),
    ]);
    await expect(
      notes.createClinicalNote({
        encounterId: fixture.visit.id,
        actor: fixture.actor,
        note: { content: " " },
      })
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_CLINICAL_NOTE" });
  });

  it("denies a non-assigned doctor for both note writes and reads", async () => {
    const fixture = await activeVisit();
    const other = await activeVisit();
    const otherActor = { userId: other.doctorUser.id, role: "doctor" };

    await expect(
      notes.createClinicalNote({
        encounterId: fixture.visit.id,
        actor: otherActor,
        note: { content: "Unauthorized note." },
      })
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    await expect(
      notes.getClinicalNotes({ encounterId: fixture.visit.id, actor: otherActor })
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    expect(
      await database
        .select()
        .from(clinicalNote)
        .where(eq(clinicalNote.encounterId, fixture.visit.id))
    ).toEqual([]);
  });

  it("serializes concurrent note writes without losing either append", async () => {
    const fixture = await activeVisit();
    const input = { encounterId: fixture.visit.id, actor: fixture.actor };
    const results = await Promise.all([
      notes.createClinicalNote({ ...input, note: { content: "Concurrent note one." } }),
      notes.createClinicalNote({ ...input, note: { content: "Concurrent note two." } }),
    ]);
    expect(results).toHaveLength(2);
    const rows = await database
      .select()
      .from(clinicalNote)
      .where(eq(clinicalNote.encounterId, fixture.visit.id))
      .orderBy(asc(clinicalNote.createdAt), asc(clinicalNote.id));
    expect(rows).toHaveLength(2);
    expect(
      await database
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "clinical_note.created"))
    ).toHaveLength(2);
  });

  it("rejects late notes and reads after consultation completion", async () => {
    const fixture = await activeVisit();
    await notes.createClinicalNote({
      encounterId: fixture.visit.id,
      actor: fixture.actor,
      note: { content: "Required note before completion." },
    });
    await consultation.completeConsultation({
      encounterId: fixture.visit.id,
      actor: fixture.actor,
    });
    await expect(
      notes.createClinicalNote({
        encounterId: fixture.visit.id,
        actor: fixture.actor,
        note: { content: "Late note." },
      })
    ).rejects.toMatchObject({ statusCode: 409, code: "ENCOUNTER_COMPLETED" });
    await expect(
      notes.getClinicalNotes({ encounterId: fixture.visit.id, actor: fixture.actor })
    ).rejects.toMatchObject({ statusCode: 409, code: "ENCOUNTER_COMPLETED" });
  });

  it("rolls back a note when its audit insert fails", async () => {
    const fixture = await activeVisit();
    await connection`
      CREATE FUNCTION fail_test_clinical_note_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.action = 'clinical_note.created' THEN
          RAISE EXCEPTION 'Test clinical-note audit failure';
        END IF;
        RETURN NEW;
      END;
      $$
    `;
    try {
      await connection`
        CREATE TRIGGER test_clinical_note_audit_failure BEFORE INSERT ON audit_log
        FOR EACH ROW EXECUTE FUNCTION fail_test_clinical_note_audit()
      `;
      await expect(
        notes.createClinicalNote({
          encounterId: fixture.visit.id,
          actor: fixture.actor,
          note: { content: "Must roll back." },
        })
      ).rejects.toThrow();
      expect(
        await database
          .select()
          .from(clinicalNote)
          .where(eq(clinicalNote.encounterId, fixture.visit.id))
      ).toEqual([]);
    } finally {
      await connection`DROP TRIGGER IF EXISTS test_clinical_note_audit_failure ON audit_log`;
      await connection`DROP FUNCTION fail_test_clinical_note_audit()`;
    }
  });

  it("does not alter the encounter while rejecting completed writes", async () => {
    const fixture = await activeVisit();
    await notes.createClinicalNote({
      encounterId: fixture.visit.id,
      actor: fixture.actor,
      note: { content: "Required note before completion." },
    });
    await consultation.completeConsultation({
      encounterId: fixture.visit.id,
      actor: fixture.actor,
    });
    expect(
      await database.select().from(encounter).where(eq(encounter.id, fixture.visit.id))
    ).toMatchObject([{ status: "completed" }]);
  });
});
