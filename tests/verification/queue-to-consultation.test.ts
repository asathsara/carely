import { inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { auditLog } from "@/lib/db/schema/audit-log";
import { clinicalNote } from "@/lib/db/schema/clinical-note";
import type { Database } from "@/lib/db/types";
import {
  createAppointment,
  createDoctor,
  createPatient,
  createUser,
} from "../helpers/factories";

const config = vi.hoisted(() => ({
  adminUrl:
    process.env.FOUNDATION_TEST_DATABASE_URL ?? process.env.BOOKING_TEST_DATABASE_URL,
  databaseName:
    "carely_workflow_test_" + Date.now() + "_" + Math.random().toString(16).slice(2),
}));

vi.mock("@/lib/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");
  const url = new URL(config.adminUrl!);
  url.pathname = "/" + config.databaseName;
  const conn = postgres(url.toString(), { max: 4, prepare: false });
  return { db: drizzle(conn), conn };
});

describe.skipIf(!config.adminUrl)(
  "SCRUM-191 implemented service path (PostgreSQL)",
  () => {
    let admin: postgres.Sql;
    let connection: postgres.Sql;
    let database: Database;

    beforeAll(async () => {
      admin = postgres(config.adminUrl!, { max: 1, connect_timeout: 5 });
      await admin`create database ${admin(config.databaseName)}`;
      const dbModule = await import("@/lib/db");
      connection = dbModule.conn;
      database = dbModule.db;
      await migrate(database, { migrationsFolder: "./drizzle" });
    }, 30_000);

    afterAll(async () => {
      await connection?.end();
      if (admin) {
        await admin`drop database if exists ${admin(config.databaseName)}`;
        await admin.end();
      }
    });

    it("checks in, records intake, opens and completes a visit with consistent queue and audit state", async () => {
      const queue = await import("@/lib/services/queue");
      const intake = await import("@/lib/services/intake");
      const consultation = await import("@/lib/services/consultation");
      const { assertEncounterWritable } = await import("@/lib/services/encounter");
      const receptionistUser = await createUser(database, { role: "receptionist" });
      const nurseUser = await createUser(database, { role: "nurse" });
      const patientUser = await createUser(database, { role: "patient" });
      const doctor = await createDoctor(database);
      const patient = await createPatient(database, { userId: patientUser.id });
      const appointment = await createAppointment(database, {
        patientId: patient.id,
        doctorId: doctor.id,
        appointmentNo: 17,
      });
      const receptionist = { userId: receptionistUser.id, role: "receptionist" };
      const nurse = { userId: nurseUser.id, role: "nurse" };
      const treatingDoctor = { userId: doctor.userId, role: "doctor" };
      const entry = await queue.checkInAppointment({
        appointmentId: appointment.id,
        actor: receptionist,
      });
      expect(
        (
          await queue.checkInAppointment({
            appointmentId: appointment.id,
            actor: receptionist,
          })
        ).id
      ).toBe(entry.id);
      const [waiting] = await intake.getNurseQueue(nurse);
      expect(waiting).toMatchObject({
        id: entry.id,
        status: "waiting",
        appointmentNo: 17,
      });
      await intake.recordIntake({
        encounterId: waiting.encounterId,
        actor: nurse,
        intake: {
          vitals: { heartRate: 82, temperatureC: 36.9 },
          complaint: "Private workflow complaint.",
          preliminaryNote: "Private nursing observations.",
        },
      });
      expect(await intake.getNurseQueue(nurse)).toEqual([]);
      expect(
        await intake.getNurseIntakeReceipt(waiting.encounterId, nurse)
      ).toMatchObject({ encounterId: waiting.encounterId });
      expect(await consultation.getDoctorConsultationQueue(treatingDoctor)).toMatchObject(
        [{ status: "intake_done", hasClinicalNote: false }]
      );
      await consultation.openConsultation({ entryId: entry.id, actor: treatingDoctor });
      await expect(
        consultation.completeConsultation({
          encounterId: waiting.encounterId,
          actor: treatingDoctor,
        })
      ).rejects.toMatchObject({ statusCode: 409, code: "CLINICAL_NOTE_REQUIRED" });

      // Teammate 3's note API is absent. This fixture exercises only the shared write contract.
      await database.transaction(async (tx) => {
        await assertEncounterWritable(waiting.encounterId, treatingDoctor, tx);
        await tx.insert(clinicalNote).values({
          encounterId: waiting.encounterId,
          authorId: treatingDoctor.userId,
          content: "Private fixture clinical note.",
        });
      });
      await consultation.completeConsultation({
        encounterId: waiting.encounterId,
        actor: treatingDoctor,
      });
      expect(await consultation.getDoctorConsultationQueue(treatingDoctor)).toMatchObject(
        [{ status: "completed", hasClinicalNote: true, appointmentNo: 17 }]
      );
      expect(
        await queue.getOwnQueueStatus({ userId: patientUser.id, role: "patient" })
      ).toMatchObject({
        entry: { status: "completed", position: null, appointmentNo: 17 },
      });
      await expect(
        database.transaction((tx) =>
          assertEncounterWritable(waiting.encounterId, treatingDoctor, tx)
        )
      ).rejects.toMatchObject({ statusCode: 409, code: "ENCOUNTER_COMPLETED" });

      const events = await database
        .select()
        .from(auditLog)
        .where(inArray(auditLog.entityId, [waiting.encounterId, entry.id]));
      expect(events).toHaveLength(8);
      expect(events.map((event) => event.action)).toEqual(
        expect.arrayContaining([
          "encounter.created",
          "queue.checked_in",
          "intake.recorded",
          "consultation.opened",
          "consultation.completed",
        ])
      );
      expect(
        events.filter((event) => event.action === "queue.status_changed")
      ).toHaveLength(3);
      expect(
        events.every((event) => event.userId && event.createdAt instanceof Date)
      ).toBe(true);
      expect(JSON.stringify(events.map((event) => event.metadata))).not.toContain(
        "Private"
      );
    });
  }
);
