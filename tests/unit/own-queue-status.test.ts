import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: mocks }));
import { getOwnQueueStatus } from "@/lib/services/queue";
function prepare(entry: object | undefined, ahead: object[] = []) {
  const rows = [[{ role: "patient", banned: false }], entry ? [entry] : [], ahead];
  const select = vi.fn(() => {
    const chain = Object.assign(Promise.resolve(rows.shift() ?? []), {
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
    });
    return chain;
  });
  mocks.transaction.mockImplementation(async (run) => run({ select }));
}
beforeEach(() => vi.resetAllMocks());
const actor = { userId: "patient", role: "patient" };
describe("Own queue response", () => {
  it("returns the selected visit's details and position without other patients' information", async () => {
    prepare(
      {
        id: "own",
        status: "waiting",
        doctorId: "doctor",
        doctorName: "Active doctor",
        appointmentId: "appointment",
        appointmentNo: 2,
        date: "2026-11-10",
      },
      [{ id: "other-private-id" }, { id: "own" }]
    );
    const result = await getOwnQueueStatus(actor);
    expect(result).toEqual({
      entry: {
        status: "waiting",
        position: 2,
        doctorName: "Active doctor",
        appointmentId: "appointment",
        appointmentNo: 2,
        date: "2026-11-10",
      },
    });
    expect(JSON.stringify(result)).not.toContain("other-private-id");
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
  });
  it("reports completion only for a completed entry and handles no check-in", async () => {
    prepare({
      id: "own",
      status: "completed",
      doctorName: "Doctor",
      appointmentId: "appointment",
      appointmentNo: 1,
      date: "2026-11-10",
    });
    expect(await getOwnQueueStatus(actor)).toMatchObject({
      entry: { status: "completed", position: null },
    });
    prepare(undefined);
    expect(await getOwnQueueStatus(actor)).toEqual({ entry: null });
  });
  it("does not mislabel an inconsistent active entry as completed", async () => {
    prepare({ id: "own", status: "waiting" }, []);
    await expect(getOwnQueueStatus(actor)).rejects.toMatchObject({ statusCode: 404 });
  });
});
