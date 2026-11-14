import { drizzle } from "drizzle-orm/postgres-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { select: mocks.select } }));

import { getNurseQueue } from "@/lib/services/intake";

const nurse = { userId: "nurse-user", role: "nurse" };
const queryDb = drizzle.mock();

function activeUser(rows: unknown[] = [{ role: "nurse", banned: false }]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe("Nurse intake queue", () => {
  it.each(["patient", "receptionist", "doctor", "pharmacist", "admin"])(
    "rejects %s service callers without querying patient data",
    async (role) => {
      await expect(getNurseQueue({ userId: "other-user", role })).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });
      expect(mocks.select).not.toHaveBeenCalled();
    }
  );

  it.each([
    { rows: [] },
    { rows: [{ role: "nurse", banned: true }] },
    { rows: [{ role: "doctor", banned: false }] },
  ])("rechecks the current account before reading the queue: %j", async ({ rows }) => {
    mocks.select.mockReturnValue(activeUser(rows));
    await expect(getNurseQueue(nurse)).rejects.toMatchObject({
      statusCode: 403,
      code: "ACCOUNT_UNAVAILABLE",
    });
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });

  it("queries today's waiting visits in stable order with a limited projection", async () => {
    // Colombo is already on 15 November while UTC is still on 14 November.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-14T20:00:00Z"));
    try {
      const row = {
        id: "entry-id",
        encounterId: "encounter-id",
        checkedInAt: new Date("2026-11-14T19:00:00Z"),
        appointmentId: "appointment-id",
        appointmentNo: 7,
        doctorId: "doctor-id",
        doctorName: "Doctor Example",
        patientId: "patient-id",
        patientNo: "P000001",
        patientName: "Patient Example",
      };
      let compiled: { sql: string; params: unknown[] } | undefined;
      mocks.select.mockReturnValueOnce(activeUser()).mockImplementationOnce((fields) => {
        // Use Drizzle's query builder so filters and joins are compiled as real SQL.
        const builder = queryDb.select(fields);
        const from = builder.from.bind(builder);
        return {
          from(...args: Parameters<typeof from>) {
            const query = from(...args);
            const orderBy = query.orderBy.bind(query);
            vi.spyOn(query, "orderBy").mockImplementation((...order) => {
              compiled = orderBy(...order).toSQL();
              return Promise.resolve([row]) as unknown as ReturnType<typeof orderBy>;
            });
            return query;
          },
        };
      });

      expect(await getNurseQueue(nurse)).toEqual([
        {
          id: row.id,
          encounterId: row.encounterId,
          status: "waiting",
          checkedInAt: row.checkedInAt.toISOString(),
          appointmentId: row.appointmentId,
          appointmentNo: 7,
          doctorId: row.doctorId,
          doctorName: row.doctorName,
          patient: {
            id: row.patientId,
            patientNo: row.patientNo,
            fullName: row.patientName,
          },
        },
      ]);
      expect(compiled?.params).toEqual([
        "2026-11-15",
        "booked",
        "waiting",
        "in_progress",
      ]);
      expect(compiled?.sql).toContain('inner join "encounter"');
      expect(compiled?.sql).toContain(
        '"encounter"."appointment_id" = "appointment"."id"'
      );
      expect(compiled?.sql).toContain('"appointment"."appointment_date" = $1');
      expect(compiled?.sql).toContain('"appointment"."status" = $2');
      expect(compiled?.sql).toContain('"queue_entry"."status" = $3');
      expect(compiled?.sql).toContain('"encounter"."status" = $4');
      expect(compiled?.sql).toContain(
        'order by "queue_entry"."checked_in_at" asc, "queue_entry"."id" asc'
      );
      expect(compiled?.sql).not.toMatch(
        /clinical_note|prescription|vitals|phone|address/
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns an empty list when the waiting queue is empty", async () => {
    const query = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    mocks.select.mockReturnValueOnce(activeUser()).mockReturnValueOnce(query);
    expect(await getNurseQueue(nurse)).toEqual([]);
  });
});
