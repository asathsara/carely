import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: mocks }));

import {
  getDoctorAvailability,
  saveDoctorAvailability,
} from "@/lib/services/availability";

const profile = {
  id: "own-doctor-profile",
  isActive: true,
  banned: false,
  role: "doctor",
};
const session = {
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "12:00",
  maxPatients: 10,
  isActive: true,
};
const dialect = new PgDialect();

function profileQuery(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

beforeEach(() => vi.resetAllMocks());

describe("Doctor availability ownership and persistence", () => {
  it("resolves the caller's profile and reads only that profile's sessions", async () => {
    const ownProfile = profileQuery([profile]);
    const scheduleQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([session]),
    };
    mocks.select.mockReturnValueOnce(ownProfile).mockReturnValueOnce(scheduleQuery);

    expect(await getDoctorAvailability("signed-in-user")).toEqual([session]);
    expect(dialect.sqlToQuery(ownProfile.where.mock.calls[0][0]).params).toEqual([
      "signed-in-user",
    ]);
    expect(dialect.sqlToQuery(scheduleQuery.where.mock.calls[0][0]).params).toEqual([
      profile.id,
    ]);
  });

  it("saves the week in one upsert under the resolved profile", async () => {
    mocks.select.mockReturnValue(profileQuery([profile]));
    const savedWeek = [{ ...session, dayOfWeek: 0, isActive: false }, session];
    const write = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([...savedWeek].reverse()),
    };
    mocks.insert.mockReturnValue(write);

    expect(
      await saveDoctorAvailability("signed-in-user", { sessions: savedWeek })
    ).toEqual(savedWeek);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(write.values).toHaveBeenCalledWith(
      savedWeek.map((item) => ({ ...item, doctorId: profile.id }))
    );
    expect(write.onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it.each([
    { rows: [], statusCode: 404 },
    { rows: [{ ...profile, isActive: false }], statusCode: 403 },
    { rows: [{ ...profile, banned: true }], statusCode: 403 },
    { rows: [{ ...profile, role: "patient" }], statusCode: 403 },
  ])(
    "rejects an unavailable or unauthorized profile: %j",
    async ({ rows, statusCode }) => {
      mocks.select.mockImplementation(() => profileQuery(rows));
      await expect(getDoctorAvailability("signed-in-user")).rejects.toMatchObject({
        statusCode,
      });
      await expect(
        saveDoctorAvailability("signed-in-user", { sessions: [session] })
      ).rejects.toMatchObject({ statusCode });
      expect(mocks.insert).not.toHaveBeenCalled();
      expect(mocks.select).toHaveBeenCalledTimes(2);
    }
  );
});
