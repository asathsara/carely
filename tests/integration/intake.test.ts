import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { user } from "@/lib/db/schema/auth";
import type { Database } from "@/lib/db/types";
import type { Actor } from "@/lib/services/access-policy";
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

describe.skipIf(!config.adminUrl)("Nurse intake queue (PostgreSQL)", () => {
  let admin: postgres.Sql;
  let connection: postgres.Sql;
  let database: Database;
  let intake: typeof import("@/lib/services/intake");
  let nurse: Actor;

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
});
