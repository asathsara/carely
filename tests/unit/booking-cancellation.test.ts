import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  now: { date: "2026-11-10", time: "11:59:59" },
}));
vi.mock("@/lib/db", () => ({ db: mocks }));
vi.mock("@/lib/clinic-time", () => ({ colomboNow: () => mocks.now }));
import { cancelAppointment } from "@/lib/services/booking";
const input = {
  appointmentId: "11111111-1111-4111-8111-111111111111",
  actor: { userId: "patient", role: "patient" },
};
function prepare(
  options: {
    date?: string;
    checkedIn?: boolean;
    missingRule?: boolean;
    status?: string;
  } = {}
) {
  const rows = [
    [{ role: "patient", banned: false }],
    [
      {
        doctorId: "doctor",
        date: options.date ?? mocks.now.date,
        patientUserId: "patient",
      },
    ],
    options.missingRule ? [] : [{ endTime: "12:00:00" }],
    [{ id: input.appointmentId, status: options.status ?? "booked" }],
    options.checkedIn ? [{ id: "queue-entry" }] : [],
  ];
  const select = vi.fn(() => {
    const chain = Object.assign(Promise.resolve(rows.shift() ?? []), {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      limit: () => chain,
      for: () => chain,
    });
    return chain;
  });
  const update = vi.fn(() => ({ set: () => ({ where: async () => [] }) }));
  mocks.transaction.mockImplementation(async (run) => run({ select, update }));
  return { update };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.now.time = "11:59:59";
});
describe("Cancellation deadline and queue protection", () => {
  it.each(["12:00:00", "12:00:01", "23:59:59"])(
    "rejects today's cancellation at %s after clinic closes",
    async (time) => {
      mocks.now.time = time;
      const { update } = prepare();
      expect(await cancelAppointment(input)).toMatchObject({
        success: false,
        code: "APPOINTMENT_CLOSED",
        statusCode: 409,
      });
      expect(update).not.toHaveBeenCalled();
    }
  );
  it("allows cancellation before the session ends", async () => {
    const { update } = prepare();
    expect(await cancelAppointment(input)).toEqual({ success: true });
    expect(update).toHaveBeenCalledTimes(1);
  });
  it("preserves check-in protection even before the clinic deadline", async () => {
    const { update } = prepare({ checkedIn: true });
    expect(await cancelAppointment(input)).toMatchObject({
      success: false,
      code: "APPOINTMENT_CLOSED",
    });
    expect(update).not.toHaveBeenCalled();
  });
  it("allows a future cancellation when its weekly rule was removed", async () => {
    prepare({ date: "2026-11-17", missingRule: true });
    expect(await cancelAppointment(input)).toEqual({ success: true });
  });
  it("rejects a past appointment and keeps repeated cancellation idempotent", async () => {
    prepare({ date: "2026-11-09" });
    expect(await cancelAppointment(input)).toMatchObject({
      success: false,
      code: "APPOINTMENT_CLOSED",
    });
    prepare({ status: "cancelled" });
    expect(await cancelAppointment(input)).toEqual({ success: true });
  });
});
