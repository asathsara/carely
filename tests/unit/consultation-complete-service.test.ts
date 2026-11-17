import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  writable: vi.fn(),
  transition: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@/lib/services/encounter", () => ({ assertEncounterWritable: mocks.writable }));
vi.mock("@/lib/services/queue", () => ({ transitionQueueEntry: mocks.transition }));

import { encounter } from "@/lib/db/schema/encounter";
import { clinicalNote } from "@/lib/db/schema/clinical-note";
import { auditLog } from "@/lib/db/schema/audit-log";
import { completeConsultation } from "@/lib/services/consultation";
import { ServiceError } from "@/lib/services/service-error";

const encounterId = "11111111-1111-4111-8111-111111111111";
const actor = { userId: "doctor-user", role: "doctor" };
const input = { encounterId, actor };

function prepare(
  options: { missingEntry?: boolean; missingNote?: boolean; conflict?: boolean } = {}
) {
  const rows = [
    options.missingEntry ? [] : [{ id: "queue-id" }],
    options.missingNote ? [] : [{ id: "note-id" }],
  ];
  const sources: unknown[] = [];
  const select = vi.fn(() => {
    const chain = Object.assign(Promise.resolve(rows.shift() ?? []), {
      from: (table: unknown) => {
        sources.push(table);
        return chain;
      },
      where: () => chain,
      limit: () => chain,
    });
    return chain;
  });
  const where = vi.fn((condition: SQL) => ({
    condition,
    returning: vi.fn().mockResolvedValue(options.conflict ? [] : [{ id: encounterId }]),
  }));
  const set = vi.fn((change: { status: string; endedAt: Date }) => ({ where, change }));
  const values = vi.fn(() => ({
    returning: vi.fn().mockResolvedValue([{ id: "audit-id" }]),
  }));
  const tx = {
    select,
    update: vi.fn(() => ({ set })),
    insert: vi.fn(() => ({ values })),
  };
  mocks.transaction.mockImplementation(async (run) => run(tx));
  mocks.writable.mockResolvedValue({ id: encounterId, appointmentId: "appointment-id" });
  mocks.transition.mockResolvedValue({ id: "queue-id", status: "completed" });
  return { tx, sources, set, where, values };
}

beforeEach(() => vi.resetAllMocks());

describe("Complete consultation", () => {
  it("requires the encounter lock and note before atomically updating and auditing", async () => {
    const { tx, sources, set, where, values } = prepare();
    const completed = await completeConsultation(input);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.writable).toHaveBeenCalledWith(encounterId, actor, tx);
    expect(mocks.writable.mock.invocationCallOrder[0]).toBeLessThan(
      tx.select.mock.invocationCallOrder[0]
    );
    expect(sources).toContain(clinicalNote);
    expect(tx.update).toHaveBeenCalledExactlyOnceWith(encounter);
    expect(tx.select.mock.invocationCallOrder[1]).toBeLessThan(
      tx.update.mock.invocationCallOrder[0]
    );
    expect(set).toHaveBeenCalledWith({ status: "completed", endedAt: expect.any(Date) });
    const condition = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(condition.params).toEqual([encounterId, "in_progress"]);
    expect(condition.sql).toContain('"encounter"."ended_at" is null');
    expect(mocks.transition).toHaveBeenCalledWith(
      { entryId: "queue-id", from: "with_doctor", to: "completed", actor },
      tx
    );
    expect(tx.insert).toHaveBeenCalledExactlyOnceWith(auditLog);
    expect(values).toHaveBeenCalledWith({
      userId: actor.userId,
      action: "consultation.completed",
      entityType: "encounter",
      entityId: encounterId,
      metadata: { fromStatus: "with_doctor", toStatus: "completed" },
    });
    expect(completed).toEqual({
      encounterId,
      queueEntryId: "queue-id",
      status: "completed",
      endedAt: set.mock.calls[0][0].endedAt.toISOString(),
    });
  });

  it.each(["patient", "receptionist", "nurse", "pharmacist", "admin"])(
    "rejects %s service callers before opening a transaction",
    async (role) => {
      await expect(
        completeConsultation({ ...input, actor: { ...actor, role } })
      ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
      expect(mocks.transaction).not.toHaveBeenCalled();
    }
  );

  it("rejects invalid IDs before querying", async () => {
    await expect(
      completeConsultation({ ...input, encounterId: "invalid" })
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_ID" });
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
      await expect(completeConsultation(input)).rejects.toMatchObject({
        statusCode,
        code,
      });
      expect(tx.select).not.toHaveBeenCalled();
      expect(tx.update).not.toHaveBeenCalled();
      expect(tx.insert).not.toHaveBeenCalled();
      expect(mocks.transition).not.toHaveBeenCalled();
    }
  );

  it.each([
    { options: { missingEntry: true }, code: "INVALID_WORKFLOW_STATE" },
    { options: { missingNote: true }, code: "CLINICAL_NOTE_REQUIRED" },
  ])(
    "does not complete when required records are missing: %j",
    async ({ options, code }) => {
      const { tx } = prepare(options);
      await expect(completeConsultation(input)).rejects.toMatchObject({
        statusCode: 409,
        code,
      });
      expect(tx.update).not.toHaveBeenCalled();
      expect(tx.insert).not.toHaveBeenCalled();
      expect(mocks.transition).not.toHaveBeenCalled();
    }
  );

  it("rejects a conditional encounter-update conflict before transitioning the queue", async () => {
    const { tx } = prepare({ conflict: true });
    await expect(completeConsultation(input)).rejects.toMatchObject({
      statusCode: 409,
      code: "ENCOUNTER_STATE_CONFLICT",
    });
    expect(mocks.transition).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("propagates queue conflicts to abort the transaction", async () => {
    const { tx } = prepare();
    mocks.transition.mockRejectedValue(
      new ServiceError("Changed state.", 409, "QUEUE_STATE_CONFLICT")
    );
    await expect(completeConsultation(input)).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("propagates audit failure rather than acknowledging partial completion", async () => {
    const { tx } = prepare();
    tx.insert.mockImplementation(() => {
      throw new Error("Audit unavailable.");
    });
    await expect(completeConsultation(input)).rejects.toThrow("Audit unavailable.");
    expect(mocks.transition).toHaveBeenCalledWith(expect.anything(), tx);
  });
});
