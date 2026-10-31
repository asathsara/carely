import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { appointment } from "@/lib/db/schema/appointment";
import { user } from "@/lib/db/schema/auth";
import { doctor } from "@/lib/db/schema/doctor";
import { doctorAvailability } from "@/lib/db/schema/doctor-availability";
import { patient } from "@/lib/db/schema/patient";
import type { BookAppointmentParams } from "@/lib/schemas/booking";

// Explicit opt-in only. Never connect to the application's DATABASE_URL.
// The supplied role must be able to CREATE DATABASE; each run owns a fresh database.
const testConfig = vi.hoisted(() => ({
  adminUrl: process.env.BOOKING_TEST_DATABASE_URL,
  databaseName: `carely_booking_test_${Date.now()}_${Math.random().toString(16).slice(2)}`,
}));

vi.mock("@/lib/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");
  const url = new URL(testConfig.adminUrl!);
  url.pathname = `/${testConfig.databaseName}`;
  const conn = postgres(url.toString(), { max: 6, prepare: false });
  return { db: drizzle(conn), conn };
});

describe.skipIf(!testConfig.adminUrl)("Transactional booking (PostgreSQL)", () => {
  let admin: postgres.Sql;
  let connection: postgres.Sql;
  let database: ReturnType<typeof drizzle>;
  let bookAppointment: typeof import("@/lib/services/booking").bookAppointment;
  let input: BookAppointmentParams;
  let doctorUserId: string;
  let otherPatientId: string;

  beforeAll(async () => {
    admin = postgres(testConfig.adminUrl!, { max: 1, prepare: false });
    await admin`create database ${admin(testConfig.databaseName)}`;
    const databaseModule = await import("@/lib/db");
    connection = databaseModule.conn;
    database = databaseModule.db;
    await migrate(database, { migrationsFolder: "./drizzle" });
    ({ bookAppointment } = await import("@/lib/services/booking"));
  }, 30_000);

  afterAll(async () => {
    await connection?.end();
    if (admin) {
      await admin`drop database if exists ${admin(testConfig.databaseName)}`;
      await admin.end();
    }
  });

  beforeEach(async () => {
    // Fake only Date, keeping database and lock-wait timers real.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T04:30:00Z")); // Saturday, 10:00 in Colombo
    await database.delete(appointment);
    await database.delete(doctorAvailability);
    await database.delete(doctor);
    await database.delete(patient);
    await database.delete(user);

    const patientUserId = randomUUID();
    doctorUserId = randomUUID();
    await database.insert(user).values([
      {
        id: patientUserId,
        name: "Patient",
        email: `${patientUserId}@test.invalid`,
        role: "patient",
      },
      {
        id: doctorUserId,
        name: "Doctor",
        email: `${doctorUserId}@test.invalid`,
        role: "doctor",
      },
    ]);
    const [profile, otherProfile] = await database
      .insert(patient)
      .values([
        { fullName: "Patient", patientNo: "PAT-TEST-1", userId: patientUserId },
        { fullName: "Walk-in", patientNo: "PAT-TEST-2" },
      ])
      .returning();
    otherPatientId = otherProfile.id;
    const [doctorProfile] = await database
      .insert(doctor)
      .values({
        userId: doctorUserId,
        consultationFee: "1500.00",
      })
      .returning();
    await database.insert(doctorAvailability).values({
      doctorId: doctorProfile.id,
      dayOfWeek: 6,
      startTime: "09:00",
      endTime: "12:00",
      maxPatients: 2,
    });
    input = {
      doctorId: doctorProfile.id,
      patientId: profile.id,
      date: "2026-10-31",
      actor: { userId: patientUserId, role: "patient" },
    };
  });

  afterEach(() => vi.useRealTimers());

  async function setCapacity(maxPatients: number) {
    await database.update(doctorAvailability).set({ maxPatients });
  }

  it("persists an online booking with token 1, fee and actor", async () => {
    const result = await bookAppointment(input);
    expect(result).toMatchObject({
      success: true,
      appointmentNo: 1,
      appointment: {
        doctorId: input.doctorId,
        patientId: input.patientId,
        appointmentDate: input.date,
        source: "online",
        status: "booked",
        feeAmount: "1500.00",
        bookedBy: input.actor.userId,
      },
    });
    expect(await database.select().from(appointment)).toHaveLength(1);
  });

  it("serializes two requests waiting for the last place", async () => {
    await setCapacity(1);
    let release!: () => void;
    let locked!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const acquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const holder = connection.begin(async (tx) => {
      await tx`select id from doctor_availability where doctor_id = ${input.doctorId} for update`;
      locked();
      await released;
    });
    await acquired;
    const pending = Promise.all([bookAppointment(input), bookAppointment(input)]);
    try {
      // Both requests must actually contend for a database lock before releasing it.
      await vi.waitFor(
        async () => {
          const [row] = await connection<{ waiting: number }[]>`
          select count(*)::int as waiting from pg_stat_activity
          where datname = current_database() and wait_event_type = 'Lock'`;
          expect(row.waiting).toBeGreaterThanOrEqual(2);
        },
        { timeout: 5000, interval: 20 }
      );
    } finally {
      release();
      await holder;
    }
    const results = await pending;
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.find((result) => !result.success)).toMatchObject({
      code: "SESSION_FULL",
      statusCode: 409,
    });
    expect(await database.select().from(appointment)).toHaveLength(1);
  });

  it("allocates distinct increasing numbers under simultaneous successful bookings", async () => {
    const results = await Promise.all([bookAppointment(input), bookAppointment(input)]);
    expect(results.every((result) => result.success)).toBe(true);
    expect(results.map((result) => result.appointmentNo).sort()).toEqual([1, 2]);
  });

  it("frees cancelled capacity without reusing its number", async () => {
    await setCapacity(1);
    const first = await bookAppointment(input);
    expect(first.success).toBe(true);
    await database
      .update(appointment)
      .set({ status: "cancelled" })
      .where(eq(appointment.id, first.appointment!.id));
    expect(await bookAppointment(input)).toMatchObject({
      success: true,
      appointmentNo: 2,
    });
  });

  it("counts completed appointments toward capacity", async () => {
    await setCapacity(1);
    await bookAppointment(input);
    await database.update(appointment).set({ status: "completed" });
    expect(await bookAppointment(input)).toMatchObject({
      code: "SESSION_FULL",
      statusCode: 409,
    });
  });

  it("keeps capacity and numbering independent for each date and doctor", async () => {
    await setCapacity(1);
    await bookAppointment(input);
    expect(await bookAppointment({ ...input, date: "2026-11-07" })).toMatchObject({
      success: true,
      appointmentNo: 1,
    });
    const anotherUser = randomUUID();
    await database
      .insert(user)
      .values({
        id: anotherUser,
        email: `${anotherUser}@test.invalid`,
        name: "Other Doctor",
        role: "doctor",
      });
    const [anotherDoctor] = await database
      .insert(doctor)
      .values({ userId: anotherUser })
      .returning();
    await database
      .insert(doctorAvailability)
      .values({
        doctorId: anotherDoctor.id,
        dayOfWeek: 6,
        startTime: "09:00",
        endTime: "12:00",
        maxPatients: 1,
      });
    expect(await bookAppointment({ ...input, doctorId: anotherDoctor.id })).toMatchObject(
      { success: true, appointmentNo: 1 }
    );
  });

  it.each(["receptionist", "admin"])(
    "allows %s to book a walk-in patient",
    async (role) => {
      await database.update(user).set({ role }).where(eq(user.id, input.actor.userId));
      expect(
        await bookAppointment({
          ...input,
          patientId: otherPatientId,
          actor: { ...input.actor, role },
        })
      ).toMatchObject({
        success: true,
        appointment: {
          patientId: otherPatientId,
          source: "reception",
          bookedBy: input.actor.userId,
        },
      });
    }
  );

  it("rejects booking for another patient", async () => {
    expect(await bookAppointment({ ...input, patientId: otherPatientId })).toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
    expect(await database.select().from(appointment)).toHaveLength(0);
  });

  it.each(["doctor", "nurse", "pharmacist"])("rejects %s actors", async (role) => {
    expect(
      await bookAppointment({ ...input, actor: { ...input.actor, role } })
    ).toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
  });

  it("rejects missing, banned and stale-role actor accounts", async () => {
    expect(
      await bookAppointment({
        ...input,
        actor: { userId: randomUUID(), role: "patient" },
      })
    ).toMatchObject({ code: "FORBIDDEN" });
    await database
      .update(user)
      .set({ banned: true })
      .where(eq(user.id, input.actor.userId));
    expect(await bookAppointment(input)).toMatchObject({ code: "FORBIDDEN" });
    await database
      .update(user)
      .set({ banned: false, role: "receptionist" })
      .where(eq(user.id, input.actor.userId));
    expect(await bookAppointment(input)).toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an unauthenticated actor and malformed inputs", async () => {
    expect(
      await bookAppointment({ ...input, actor: { userId: "", role: "patient" } })
    ).toMatchObject({ statusCode: 401 });
    for (const invalid of [
      { date: "2026-02-30" },
      { patientId: "invalid" },
      { doctorId: "invalid" },
    ]) {
      expect(await bookAppointment({ ...input, ...invalid })).toMatchObject({
        code: "INVALID_INPUT",
        statusCode: 400,
      });
    }
  });

  it("rejects missing patients for staff and missing doctors", async () => {
    await database
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.id, input.actor.userId));
    const staffInput = { ...input, actor: { ...input.actor, role: "admin" } };
    expect(
      await bookAppointment({ ...staffInput, patientId: randomUUID() })
    ).toMatchObject({ code: "PATIENT_NOT_FOUND", statusCode: 404 });
    expect(
      await bookAppointment({ ...input, doctorId: randomUUID(), actor: staffInput.actor })
    ).toMatchObject({ code: "DOCTOR_NOT_FOUND", statusCode: 404 });
  });

  it("rejects an inactive doctor, banned doctor account, or changed doctor role", async () => {
    await database.update(doctor).set({ isActive: false });
    expect(await bookAppointment(input)).toMatchObject({ code: "DOCTOR_INACTIVE" });
    await database.update(doctor).set({ isActive: true });
    await database.update(user).set({ banned: true }).where(eq(user.id, doctorUserId));
    expect(await bookAppointment(input)).toMatchObject({ code: "DOCTOR_INACTIVE" });
    await database
      .update(user)
      .set({ banned: false, role: "nurse" })
      .where(eq(user.id, doctorUserId));
    expect(await bookAppointment(input)).toMatchObject({ code: "DOCTOR_INACTIVE" });
  });

  it("rejects missing and disabled weekday rules", async () => {
    expect(await bookAppointment({ ...input, date: "2026-11-01" })).toMatchObject({
      code: "NO_ACTIVE_SESSION",
    });
    await database.update(doctorAvailability).set({ isActive: false });
    expect(await bookAppointment(input)).toMatchObject({ code: "NO_ACTIVE_SESSION" });
  });

  it("uses Colombo's date across UTC midnight", async () => {
    vi.setSystemTime(new Date("2026-10-30T20:00:00Z")); // Saturday 01:30 Colombo
    expect(await bookAppointment(input)).toMatchObject({ success: true });
    vi.setSystemTime(new Date("2026-10-31T20:00:00Z")); // Sunday 01:30 Colombo
    expect(await bookAppointment(input)).toMatchObject({
      code: "PAST_DATE",
      statusCode: 400,
    });
  });

  it("allows today before end, rejects at/after end, and allows future sessions", async () => {
    vi.setSystemTime(new Date("2026-10-31T06:29:59Z")); // 11:59:59
    expect(await bookAppointment(input)).toMatchObject({ success: true });
    vi.setSystemTime(new Date("2026-10-31T06:30:00Z")); // 12:00:00
    expect(await bookAppointment(input)).toMatchObject({
      code: "SESSION_ENDED",
      statusCode: 400,
    });
    vi.setSystemTime(new Date("2026-10-31T06:30:01Z"));
    expect(await bookAppointment(input)).toMatchObject({ code: "SESSION_ENDED" });
    expect(await bookAppointment({ ...input, date: "2026-11-07" })).toMatchObject({
      success: true,
    });
  });

  it("rechecks the session end after waiting for the availability lock", async () => {
    let release!: () => void;
    let locked!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const acquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const holder = connection.begin(async (tx) => {
      await tx`select id from doctor_availability where doctor_id = ${input.doctorId} for update`;
      locked();
      await released;
    });
    await acquired;
    const pending = bookAppointment(input);
    try {
      await vi.waitFor(
        async () => {
          const [row] = await connection<
            { waiting: number }[]
          >`select count(*)::int as waiting from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`;
          expect(row.waiting).toBeGreaterThanOrEqual(1);
        },
        { timeout: 5000, interval: 20 }
      );
      vi.setSystemTime(new Date("2026-10-31T06:30:00Z"));
    } finally {
      release();
      await holder;
    }
    expect(await pending).toMatchObject({ code: "SESSION_ENDED" });
    expect(await database.select().from(appointment)).toHaveLength(0);
  });

  it("rolls back an insert failure and leaves the next token available", async () => {
    // A test-only constraint forces an actual insert error inside the transaction.
    await database.execute(
      sql`alter table appointment add constraint test_reject_insert check (appointment_no < 1)`
    );
    try {
      await expect(bookAppointment(input)).rejects.toThrow();
      expect(await database.select().from(appointment)).toHaveLength(0);
    } finally {
      await database.execute(
        sql`alter table appointment drop constraint test_reject_insert`
      );
    }
    expect(await bookAppointment(input)).toMatchObject({
      success: true,
      appointmentNo: 1,
    });
  });
});
