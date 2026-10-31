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
import { specialty } from "@/lib/db/schema/specialty";
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
  let getOpenDatesForDoctor: typeof import("@/lib/services/booking").getOpenDatesForDoctor;
  let cancelAppointment: typeof import("@/lib/services/booking").cancelAppointment;
  let getPatientAppointments: typeof import("@/lib/services/patient-booking").getPatientAppointments;
  let getPatientDoctors: typeof import("@/lib/services/patient-booking").getPatientDoctors;
  let getOrCreatePatientForUser: typeof import("@/lib/services/patient").getOrCreatePatientForUser;
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
    ({ bookAppointment, getOpenDatesForDoctor, cancelAppointment } =
      await import("@/lib/services/booking"));
    ({ getPatientAppointments, getPatientDoctors } =
      await import("@/lib/services/patient-booking"));
    ({ getOrCreatePatientForUser } = await import("@/lib/services/patient"));
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

  describe("Patient appointments and cancellation", () => {
    it("loads saved bookings and an owned confirmation by reference", async () => {
      const booked = await bookAppointment(input);
      expect(await getPatientAppointments(input.actor.userId)).toMatchObject([
        {
          id: booked.appointment!.id,
          doctorName: "Doctor",
          date: input.date,
          appointmentNo: 1,
          status: "booked",
          isUpcoming: true,
          canCancel: true,
          feeAmount: "1500.00",
        },
      ]);
      expect(
        await getPatientAppointments(input.actor.userId, booked.appointment!.id)
      ).toHaveLength(1);
      expect(await getPatientAppointments(input.actor.userId, randomUUID())).toEqual([]);
    });

    it("never lists or confirms another patient's booking", async () => {
      const own = await bookAppointment(input);
      const [foreign] = await database
        .insert(appointment)
        .values({
          doctorId: input.doctorId,
          patientId: otherPatientId,
          appointmentDate: input.date,
          appointmentNo: 2,
        })
        .returning();
      expect(
        (await getPatientAppointments(input.actor.userId)).map((row) => row.id)
      ).toEqual([own.appointment!.id]);
      expect(await getPatientAppointments(input.actor.userId, foreign.id)).toEqual([]);
      expect(
        await cancelAppointment({ appointmentId: foreign.id, actor: input.actor })
      ).toMatchObject({ statusCode: 404 });
      expect(
        (
          await database.select().from(appointment).where(eq(appointment.id, foreign.id))
        )[0].status
      ).toBe("booked");
    });

    it("retains past, cancelled and completed visits in history in date order", async () => {
      await database.insert(appointment).values([
        {
          doctorId: input.doctorId,
          patientId: input.patientId,
          appointmentDate: "2026-11-07",
          appointmentNo: 1,
        },
        {
          doctorId: input.doctorId,
          patientId: input.patientId,
          appointmentDate: "2026-10-24",
          appointmentNo: 1,
        },
        {
          doctorId: input.doctorId,
          patientId: input.patientId,
          appointmentDate: input.date,
          appointmentNo: 1,
          status: "completed",
        },
        {
          doctorId: input.doctorId,
          patientId: input.patientId,
          appointmentDate: input.date,
          appointmentNo: 2,
          status: "cancelled",
        },
      ]);
      const rows = await getPatientAppointments(input.actor.userId);
      expect(rows.map((row) => row.date)).toEqual([
        "2026-10-24",
        input.date,
        input.date,
        "2026-11-07",
      ]);
      expect(rows.map((row) => row.isUpcoming)).toEqual([false, false, false, true]);
      expect(rows.map((row) => row.canCancel)).toEqual([false, false, false, true]);
    });

    it("cancels idempotently, restores availability and preserves token numbering", async () => {
      await setCapacity(1);
      const booked = await bookAppointment(input);
      const cancelInput = { appointmentId: booked.appointment!.id, actor: input.actor };
      expect(await cancelAppointment(cancelInput)).toEqual({ success: true });
      expect(await cancelAppointment(cancelInput)).toEqual({ success: true });
      expect((await getPatientAppointments(input.actor.userId))[0]).toMatchObject({
        status: "cancelled",
        appointmentNo: 1,
        canCancel: false,
      });
      expect((await getOpenDatesForDoctor(input.doctorId)).dates[0]).toMatchObject({
        date: input.date,
        availableCount: 1,
      });
      expect(await bookAppointment(input)).toMatchObject({
        success: true,
        appointmentNo: 2,
      });
    });

    it("serializes simultaneous cancellations and a booking without overbooking", async () => {
      await setCapacity(1);
      const booked = await bookAppointment(input);
      const cancelInput = { appointmentId: booked.appointment!.id, actor: input.actor };
      const results = await Promise.all([
        cancelAppointment(cancelInput),
        cancelAppointment(cancelInput),
        bookAppointment(input),
      ]);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      if (!results[2].success) {
        expect(results[2]).toMatchObject({ code: "SESSION_FULL" });
        expect(await bookAppointment(input)).toMatchObject({
          success: true,
          appointmentNo: 2,
        });
      }
      const rows = await database.select().from(appointment);
      expect(rows.filter((row) => row.status === "booked")).toHaveLength(1);
      expect(rows.map((row) => row.appointmentNo).sort()).toEqual([1, 2]);
    });

    it.each(["receptionist", "admin"])(
      "allows %s to cancel a walk-in booking",
      async (role) => {
        await database.update(user).set({ role }).where(eq(user.id, input.actor.userId));
        const actor = { ...input.actor, role };
        const booked = await bookAppointment({
          ...input,
          patientId: otherPatientId,
          actor,
        });
        expect(
          await cancelAppointment({ appointmentId: booked.appointment!.id, actor })
        ).toEqual({ success: true });
      }
    );

    it("rejects completed or checked-in status and elapsed appointments", async () => {
      const booked = await bookAppointment(input);
      const cancelInput = { appointmentId: booked.appointment!.id, actor: input.actor };
      for (const status of ["completed", "checked_in"]) {
        await database.update(appointment).set({ status });
        expect(await cancelAppointment(cancelInput)).toMatchObject({
          code: "APPOINTMENT_CLOSED",
          statusCode: 409,
        });
      }
      await database.update(appointment).set({ status: "booked" });
      vi.setSystemTime(new Date("2026-10-31T06:30:00Z"));
      expect(await cancelAppointment(cancelInput)).toMatchObject({
        code: "APPOINTMENT_CLOSED",
      });
      expect((await getPatientAppointments(input.actor.userId))[0]).toMatchObject({
        isUpcoming: false,
        canCancel: false,
      });
      vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
      expect(await cancelAppointment(cancelInput)).toMatchObject({
        code: "APPOINTMENT_CLOSED",
      });
    });

    it("allows cancelling a future booking after its weekly rule was removed", async () => {
      const booked = await bookAppointment({ ...input, date: "2026-11-07" });
      await database.delete(doctorAvailability);
      expect(
        await cancelAppointment({
          appointmentId: booked.appointment!.id,
          actor: input.actor,
        })
      ).toEqual({ success: true });
    });

    it("rejects malformed, missing, banned, and stale-role cancellation actors", async () => {
      const booked = await bookAppointment(input);
      const cancelInput = { appointmentId: booked.appointment!.id, actor: input.actor };
      expect(
        await cancelAppointment({ ...cancelInput, appointmentId: "invalid" })
      ).toMatchObject({ statusCode: 400 });
      expect(
        await cancelAppointment({ ...cancelInput, appointmentId: randomUUID() })
      ).toMatchObject({ statusCode: 404 });
      expect(
        await cancelAppointment({
          ...cancelInput,
          actor: { userId: "", role: "patient" },
        })
      ).toMatchObject({ statusCode: 401 });
      expect(
        await cancelAppointment({
          ...cancelInput,
          actor: { ...input.actor, role: "nurse" },
        })
      ).toMatchObject({ statusCode: 403 });
      await database
        .update(user)
        .set({ banned: true })
        .where(eq(user.id, input.actor.userId));
      expect(await cancelAppointment(cancelInput)).toMatchObject({ statusCode: 403 });
      await expect(getPatientAppointments(input.actor.userId)).rejects.toMatchObject({
        statusCode: 403,
      });
      await database
        .update(user)
        .set({ banned: false, role: "admin" })
        .where(eq(user.id, input.actor.userId));
      expect(await cancelAppointment(cancelInput)).toMatchObject({ statusCode: 403 });
      await expect(getPatientAppointments(input.actor.userId)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("lists only active doctor accounts from the database", async () => {
      expect(await getPatientDoctors()).toMatchObject([
        { id: input.doctorId, name: "Doctor", consultationFee: "1500.00" },
      ]);
      await database.update(doctor).set({ isActive: false });
      expect(await getPatientDoctors()).toEqual([]);
      await database.update(doctor).set({ isActive: true });
      await database.update(user).set({ banned: true }).where(eq(user.id, doctorUserId));
      expect(await getPatientDoctors()).toEqual([]);
      await database
        .update(user)
        .set({ banned: false, role: "nurse" })
        .where(eq(user.id, doctorUserId));
      expect(await getPatientDoctors()).toEqual([]);
    });

    it("creates a patient profile idempotently for concurrent first visits", async () => {
      const userId = randomUUID();
      await database
        .insert(user)
        .values({
          id: userId,
          name: "New Patient",
          email: `${userId}@test.invalid`,
          role: "patient",
        });
      const profiles = await Promise.all([
        getOrCreatePatientForUser(userId),
        getOrCreatePatientForUser(userId),
      ]);
      expect(profiles[0].id).toBe(profiles[1].id);
      expect(profiles[0].fullName).toBe("New Patient");
      expect(
        await database.select().from(patient).where(eq(patient.userId, userId))
      ).toHaveLength(1);
    });
  });

  describe("Open date discovery", () => {
    it("returns recurring sessions, metadata and initial capacity in date order", async () => {
      const [specialtyRow] = await database.select().from(specialty).limit(1);
      await database.update(doctor).set({ specialtyId: specialtyRow.id });
      expect(await getOpenDatesForDoctor(input.doctorId)).toEqual({
        doctorId: input.doctorId,
        doctorName: "Doctor",
        specialtyName: specialtyRow.name,
        dates: ["2026-10-31", "2026-11-07"].map((date) => ({
          date,
          dayOfWeek: 6,
          startTime: "09:00:00",
          endTime: "12:00:00",
          maxPatients: 2,
          bookedCount: 0,
          availableCount: 2,
        })),
      });
    });

    it("includes exactly today through day 13 across the month boundary", async () => {
      await database.delete(doctorAvailability);
      await database.insert(doctorAvailability).values(
        Array.from({ length: 7 }, (_, dayOfWeek) => ({
          doctorId: input.doctorId,
          dayOfWeek,
          startTime: "09:00",
          endTime: "12:00",
          maxPatients: 2,
        }))
      );
      const result = await getOpenDatesForDoctor(input.doctorId);
      expect(result.dates).toHaveLength(14);
      expect(result.dates[0].date).toBe("2026-10-31");
      expect(result.dates[13].date).toBe("2026-11-13");
      expect(result.dates.some((day) => day.date === "2026-11-14")).toBe(false);
    });

    it("excludes full dates and restores capacity after a cancellation", async () => {
      await setCapacity(1);
      await bookAppointment(input);
      expect(
        (await getOpenDatesForDoctor(input.doctorId)).dates.map((day) => day.date)
      ).toEqual(["2026-11-07"]);
      await database.update(appointment).set({ status: "cancelled" });
      expect((await getOpenDatesForDoctor(input.doctorId)).dates[0]).toMatchObject({
        date: input.date,
        bookedCount: 0,
        availableCount: 1,
      });
    });

    it("counts completed visits and keeps each date's capacity separate", async () => {
      await bookAppointment(input);
      await database.update(appointment).set({ status: "completed" });
      const result = await getOpenDatesForDoctor(input.doctorId);
      expect(result.dates[0]).toMatchObject({ bookedCount: 1, availableCount: 1 });
      expect(result.dates[1]).toMatchObject({ bookedCount: 0, availableCount: 2 });
    });

    it("does not count another doctor's appointments", async () => {
      await bookAppointment(input);
      const otherUserId = randomUUID();
      await database.insert(user).values({
        id: otherUserId,
        name: "Other Doctor",
        email: `${otherUserId}@test.invalid`,
        role: "doctor",
      });
      const [otherDoctor] = await database
        .insert(doctor)
        .values({ userId: otherUserId })
        .returning();
      await database.insert(doctorAvailability).values({
        doctorId: otherDoctor.id,
        dayOfWeek: 6,
        startTime: "09:00",
        endTime: "12:00",
        maxPatients: 1,
      });
      expect((await getOpenDatesForDoctor(otherDoctor.id)).dates[0]).toMatchObject({
        bookedCount: 0,
        availableCount: 1,
      });
    });

    it("returns empty dates for missing or disabled sessions and omits absent specialty", async () => {
      await database.update(doctorAvailability).set({ isActive: false });
      expect(await getOpenDatesForDoctor(input.doctorId)).toEqual({
        doctorId: input.doctorId,
        doctorName: "Doctor",
        dates: [],
      });
      await database.delete(doctorAvailability);
      expect((await getOpenDatesForDoctor(input.doctorId)).dates).toEqual([]);
    });

    it("omits dates where capacity has been lowered below the booked count", async () => {
      await bookAppointment(input);
      await bookAppointment(input);
      await setCapacity(1);
      expect(
        (await getOpenDatesForDoctor(input.doctorId)).dates.map((day) => day.date)
      ).toEqual(["2026-11-07"]);
    });

    it("uses Colombo's day and start of the window when UTC is still the previous day", async () => {
      vi.setSystemTime(new Date("2026-10-30T20:00:00Z")); // Saturday 01:30 Colombo
      expect((await getOpenDatesForDoctor(input.doctorId)).dates[0].date).toBe(
        "2026-10-31"
      );
      vi.setSystemTime(new Date("2026-10-31T20:00:00Z")); // Sunday 01:30 Colombo
      expect(
        (await getOpenDatesForDoctor(input.doctorId)).dates.map((day) => day.date)
      ).toEqual(["2026-11-07", "2026-11-14"]);
    });

    it("excludes today at/after session end but keeps future sessions", async () => {
      vi.setSystemTime(new Date("2026-10-31T06:29:59Z"));
      expect((await getOpenDatesForDoctor(input.doctorId)).dates).toHaveLength(2);
      for (const time of ["2026-10-31T06:30:00Z", "2026-10-31T06:30:01Z"]) {
        vi.setSystemTime(new Date(time));
        expect(
          (await getOpenDatesForDoctor(input.doctorId)).dates.map((day) => day.date)
        ).toEqual(["2026-11-07"]);
      }
    });

    it("rejects invalid and nonexistent doctor IDs", async () => {
      await expect(getOpenDatesForDoctor("invalid")).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_INPUT",
      });
      await expect(getOpenDatesForDoctor(randomUUID())).rejects.toMatchObject({
        statusCode: 404,
        code: "DOCTOR_NOT_FOUND",
      });
    });

    it("rejects inactive, banned, and reassigned doctor accounts", async () => {
      await database.update(doctor).set({ isActive: false });
      await expect(getOpenDatesForDoctor(input.doctorId)).rejects.toMatchObject({
        code: "DOCTOR_INACTIVE",
        statusCode: 400,
      });
      await database.update(doctor).set({ isActive: true });
      await database.update(user).set({ banned: true }).where(eq(user.id, doctorUserId));
      await expect(getOpenDatesForDoctor(input.doctorId)).rejects.toMatchObject({
        code: "DOCTOR_INACTIVE",
      });
      await database
        .update(user)
        .set({ banned: false, role: "nurse" })
        .where(eq(user.id, doctorUserId));
      await expect(getOpenDatesForDoctor(input.doctorId)).rejects.toMatchObject({
        code: "DOCTOR_INACTIVE",
      });
    });
  });

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
    await database.insert(user).values({
      id: anotherUser,
      email: `${anotherUser}@test.invalid`,
      name: "Other Doctor",
      role: "doctor",
    });
    const [anotherDoctor] = await database
      .insert(doctor)
      .values({ userId: anotherUser })
      .returning();
    await database.insert(doctorAvailability).values({
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
