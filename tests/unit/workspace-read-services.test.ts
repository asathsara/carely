import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { select: mocks.select } }));
vi.mock("@/lib/clinic-time", () => ({
  colomboNow: () => ({ date: "2026-11-14", time: "10:00:00" }),
}));

import { getDoctorConsultationQueue } from "@/lib/services/consultation";
import { getNurseIntakeReceipt } from "@/lib/services/intake";

const encounterId = "11111111-1111-4111-8111-111111111111";
const dialect = new PgDialect();
function query(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
}
beforeEach(() => vi.resetAllMocks());

describe("Workspace read authorization", () => {
  it("limits doctor reads to the active session profile and today's booked visits", async () => {
    const actor = { userId: "doctor-user", role: "doctor" };
    const account = query([{ role: "doctor", banned: false }]);
    const profile = query([{ id: "own-profile" }]);
    const entries = query([
      {
        queueEntryId: "queue-id",
        encounterId,
        status: "with_doctor",
        appointmentNo: 7,
        checkedInAt: new Date("2026-11-14T04:00:00Z"),
        hasClinicalNote: true,
        patientId: "patient-id",
        patientNo: "P0001",
        patientName: "Patient Example",
      },
    ]);
    mocks.select
      .mockReturnValueOnce(account)
      .mockReturnValueOnce(profile)
      .mockReturnValueOnce(entries);
    const result = await getDoctorConsultationQueue(actor);
    expect(dialect.sqlToQuery(profile.where.mock.calls[0][0]).params).toEqual([
      actor.userId,
      true,
    ]);
    expect(dialect.sqlToQuery(entries.where.mock.calls[0][0]).params).toEqual([
      "own-profile",
      "2026-11-14",
      "booked",
    ]);
    expect(result[0]).toMatchObject({
      encounterId,
      hasClinicalNote: true,
      patient: { id: "patient-id", fullName: "Patient Example" },
    });
    const projection = mocks.select.mock.calls[2][0];
    expect(dialect.sqlToQuery(projection.hasClinicalNote).sql).toContain(
      '"clinical_note"."encounter_id" = "encounter"."id"'
    );
    expect(Object.keys(projection)).not.toContain("content");
  });

  it("does not return a queue without an active doctor profile", async () => {
    mocks.select
      .mockReturnValueOnce(query([{ role: "doctor", banned: false }]))
      .mockReturnValueOnce(query([]));
    await expect(
      getDoctorConsultationQueue({ userId: "doctor-user", role: "doctor" })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.select).toHaveBeenCalledTimes(2);
  });

  it("returns only a timestamp receipt for today's own intake action", async () => {
    const actor = { userId: "nurse-user", role: "nurse" };
    const receipt = query([{ recordedAt: new Date("2026-11-14T04:00:00Z") }]);
    mocks.select
      .mockReturnValueOnce(query([{ role: "nurse", banned: false }]))
      .mockReturnValueOnce(receipt);
    expect(await getNurseIntakeReceipt(encounterId, actor)).toEqual({
      encounterId,
      recordedAt: "2026-11-14T04:00:00.000Z",
    });
    expect(dialect.sqlToQuery(receipt.where.mock.calls[0][0]).params).toEqual([
      encounterId,
      "2026-11-14",
      actor.userId,
      "intake.recorded",
    ]);
    expect(Object.keys(mocks.select.mock.calls[1][0])).toEqual(["recordedAt"]);
  });

  it("returns 404 for receipts belonging to another nurse or another date", async () => {
    mocks.select
      .mockReturnValueOnce(query([{ role: "nurse", banned: false }]))
      .mockReturnValueOnce(query([]));
    await expect(
      getNurseIntakeReceipt(encounterId, { userId: "other-nurse", role: "nurse" })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it.each(["patient", "receptionist", "pharmacist", "admin"])(
    "denies %s before querying",
    async (role) => {
      const actor = { userId: "other-user", role };
      await expect(getNurseIntakeReceipt(encounterId, actor)).rejects.toMatchObject({
        statusCode: 403,
      });
      await expect(getDoctorConsultationQueue(actor)).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(mocks.select).not.toHaveBeenCalled();
    }
  );

  it.each(["nurse", "doctor"])("rechecks the current %s account", async (role) => {
    mocks.select.mockReturnValue(query([{ role, banned: true }]));
    const actor = { userId: "banned-user", role };
    await expect(
      role === "nurse"
        ? getNurseIntakeReceipt(encounterId, actor)
        : getDoctorConsultationQueue(actor)
    ).rejects.toMatchObject({ statusCode: 403, code: "ACCOUNT_UNAVAILABLE" });
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });
});
