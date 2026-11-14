import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  writable: vi.fn(),
  transition: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@/lib/services/encounter", () => ({ assertEncounterWritable: mocks.writable }));
vi.mock("@/lib/services/queue", () => ({ transitionQueueEntry: mocks.transition }));

import { vitals } from "@/lib/db/schema/vitals";
import { preliminaryNote } from "@/lib/db/schema/preliminary-note";
import { auditLog } from "@/lib/db/schema/audit-log";
import { recordIntake } from "@/lib/services/intake";
import { ServiceError } from "@/lib/services/service-error";

const encounterId = "11111111-1111-4111-8111-111111111111";
const actor = { userId: "nurse-user", role: "nurse" };
const input = {
  encounterId,
  actor,
  intake: {
    vitals: {
      heartRate: 82,
      temperatureC: 36.9,
      weightKg: 68.3,
      heightCm: null,
      additional: { glucose: 5.4 },
    },
    complaint: "Headache since yesterday.",
    preliminaryNote: "Patient is alert.",
  },
};

function prepare() {
  const writes: { table: unknown; values: Record<string, unknown> }[] = [];
  const query = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ id: "queue-id" }]),
  };
  const tx = {
    select: vi.fn(() => query),
    insert: vi.fn((table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        writes.push({ table, values });
        return {
          returning: vi
            .fn()
            .mockResolvedValue([
              {
                id:
                  table === vitals
                    ? "vitals-id"
                    : table === preliminaryNote
                      ? "note-id"
                      : "audit-id",
              },
            ]),
        };
      },
    })),
  };
  mocks.transaction.mockImplementation(async (run) => run(tx));
  mocks.writable.mockResolvedValue({ id: encounterId, appointmentId: "appointment-id" });
  mocks.transition.mockResolvedValue({ id: "queue-id", status: "intake_done" });
  return { tx, writes, query };
}

beforeEach(() => vi.resetAllMocks());

describe("Intake persistence and handoff", () => {
  it("writes records, handoff and privacy-safe audit in the same transaction", async () => {
    const { tx, writes } = prepare();
    const result = await recordIntake(input);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.writable).toHaveBeenCalledWith(encounterId, actor, tx);
    expect(mocks.writable.mock.invocationCallOrder[0]).toBeLessThan(
      tx.select.mock.invocationCallOrder[0]
    );
    expect(writes[0]).toMatchObject({
      table: vitals,
      values: {
        encounterId,
        recordedBy: actor.userId,
        recordedAt: expect.any(Date),
        heartRate: 82,
        temperatureC: "36.9",
        weightKg: "68.3",
        heightCm: null,
        additional: { glucose: 5.4 },
      },
    });
    expect(writes[1]).toMatchObject({
      table: preliminaryNote,
      values: {
        encounterId,
        authorId: actor.userId,
        content: `Initial complaint:\n${input.intake.complaint}\n\nPreliminary note:\n${input.intake.preliminaryNote}`,
        createdAt: writes[0].values.recordedAt,
      },
    });
    expect(mocks.transition).toHaveBeenCalledWith(
      { entryId: "queue-id", from: "waiting", to: "intake_done", actor },
      tx
    );
    expect(writes[2]).toEqual({
      table: auditLog,
      values: {
        userId: actor.userId,
        action: "intake.recorded",
        entityType: "encounter",
        entityId: encounterId,
        metadata: {},
      },
    });
    expect(result).toEqual({
      encounterId,
      queueEntryId: "queue-id",
      status: "intake_done",
      vitalsId: "vitals-id",
      preliminaryNoteId: "note-id",
      recordedAt: (writes[0].values.recordedAt as Date).toISOString(),
    });
  });

  it.each(["patient", "receptionist", "doctor", "pharmacist", "admin"])(
    "rejects %s service callers before opening a transaction",
    async (role) => {
      await expect(
        recordIntake({ ...input, actor: { ...actor, role } })
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(mocks.transaction).not.toHaveBeenCalled();
    }
  );

  it("validates the encounter ID and input even for direct service callers", async () => {
    await expect(
      recordIntake({ ...input, encounterId: "invalid" })
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_ID" });
    await expect(
      recordIntake({ ...input, intake: { ...input.intake, vitals: { heartRate: -1 } } })
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_INTAKE" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([
    { statusCode: 403, code: "ACCOUNT_UNAVAILABLE" },
    { statusCode: 404, code: "NOT_FOUND" },
    { statusCode: 409, code: "INVALID_WORKFLOW_STATE" },
    { statusCode: 409, code: "ENCOUNTER_COMPLETED" },
  ])(
    "makes no writes when encounter authorization fails: %j",
    async ({ statusCode, code }) => {
      const { tx } = prepare();
      mocks.writable.mockRejectedValue(
        new ServiceError("Unavailable visit.", statusCode, code)
      );
      await expect(recordIntake(input)).rejects.toMatchObject({ statusCode, code });
      expect(tx.insert).not.toHaveBeenCalled();
      expect(mocks.transition).not.toHaveBeenCalled();
    }
  );

  it("rejects a missing queue entry before writing", async () => {
    const { tx, query } = prepare();
    query.limit.mockResolvedValue([]);
    await expect(recordIntake(input)).rejects.toMatchObject({
      statusCode: 409,
      code: "INVALID_WORKFLOW_STATE",
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("propagates a handoff conflict to abort the transaction without an intake audit", async () => {
    const { writes } = prepare();
    mocks.transition.mockRejectedValue(
      new ServiceError("Changed state.", 409, "QUEUE_STATE_CONFLICT")
    );
    await expect(recordIntake(input)).rejects.toMatchObject({ statusCode: 409 });
    expect(writes.map((write) => write.table)).toEqual([vitals, preliminaryNote]);
  });

  it("propagates an audit failure instead of acknowledging a partial save", async () => {
    const { tx } = prepare();
    const insert = tx.insert.getMockImplementation()!;
    tx.insert.mockImplementation((table) => {
      if (table === auditLog) throw new Error("Audit unavailable.");
      return insert(table);
    });
    await expect(recordIntake(input)).rejects.toThrow("Audit unavailable.");
    expect(mocks.transition).toHaveBeenCalledWith(expect.anything(), tx);
  });
});
