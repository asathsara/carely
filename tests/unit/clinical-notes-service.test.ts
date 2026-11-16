import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), writable: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@/lib/services/encounter", () => ({ assertEncounterWritable: mocks.writable }));

import { auditLog } from "@/lib/db/schema/audit-log";
import { clinicalNote } from "@/lib/db/schema/clinical-note";
import { createClinicalNote, getClinicalNotes } from "@/lib/services/clinical-notes";
import { ServiceError } from "@/lib/services/service-error";

const encounterId = "11111111-1111-4111-8111-111111111111";
const actor = { userId: "doctor-user", role: "doctor" };

function prepare() {
  const writes: { table: unknown; values: Record<string, unknown> }[] = [];
  const noteRows = [
    {
      id: "note-one",
      encounterId,
      content: "First note.",
      createdAt: new Date("2026-11-14T10:00:00.000Z"),
    },
    {
      id: "note-two",
      encounterId,
      content: "Second note.",
      createdAt: new Date("2026-11-14T10:01:00.000Z"),
    },
  ];
  const select = vi.fn(() => {
    const chain = Object.assign(Promise.resolve(noteRows), {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
    });
    return chain;
  });
  const tx = {
    select,
    insert: vi.fn((table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        writes.push({ table, values });
        return {
          returning: vi.fn().mockResolvedValue([
            table === clinicalNote
              ? {
                  id: "note-id",
                  encounterId,
                  content: values.content,
                  createdAt: values.createdAt,
                }
              : { id: "audit-id" },
          ]),
        };
      },
    })),
  };
  mocks.transaction.mockImplementation(async (run) => run(tx));
  mocks.writable.mockResolvedValue({ id: encounterId, appointmentId: "appointment-id" });
  return { tx, writes };
}

beforeEach(() => vi.resetAllMocks());

describe("clinical note service", () => {
  it("writes an append-only note and its privacy-safe audit event in one transaction", async () => {
    const { tx, writes } = prepare();
    const result = await createClinicalNote({
      encounterId,
      actor,
      note: { content: "  Clinical observation.  " },
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.writable).toHaveBeenCalledWith(encounterId, actor, tx);
    expect(writes).toEqual([
      {
        table: clinicalNote,
        values: {
          encounterId,
          authorId: actor.userId,
          content: "Clinical observation.",
          createdAt: expect.any(Date),
        },
      },
      {
        table: auditLog,
        values: {
          userId: actor.userId,
          action: "clinical_note.created",
          entityType: "clinical_note",
          entityId: "note-id",
          metadata: {},
        },
      },
    ]);
    expect(result).toEqual({
      id: "note-id",
      encounterId,
      content: "Clinical observation.",
      createdAt: (writes[0].values.createdAt as Date).toISOString(),
    });
  });

  it("lists notes in service order after authorizing the encounter", async () => {
    const { tx } = prepare();
    await expect(getClinicalNotes({ encounterId, actor })).resolves.toEqual([
      {
        id: "note-one",
        encounterId,
        content: "First note.",
        createdAt: "2026-11-14T10:00:00.000Z",
      },
      {
        id: "note-two",
        encounterId,
        content: "Second note.",
        createdAt: "2026-11-14T10:01:00.000Z",
      },
    ]);
    expect(mocks.writable).toHaveBeenCalledWith(encounterId, actor, tx);
  });

  it.each(["patient", "receptionist", "nurse", "pharmacist", "admin"])(
    "rejects %s before opening a transaction",
    async (role) => {
      await expect(
        createClinicalNote({
          encounterId,
          actor: { ...actor, role },
          note: { content: "Note" },
        })
      ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
      expect(mocks.transaction).not.toHaveBeenCalled();
    }
  );

  it("rejects invalid identifiers and note payloads before opening a transaction", async () => {
    await expect(
      createClinicalNote({ encounterId: "invalid", actor, note: { content: "Note" } })
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_ID" });
    await expect(
      createClinicalNote({ encounterId, actor, note: { content: " " } })
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_CLINICAL_NOTE" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([
    { statusCode: 403, code: "ACCOUNT_UNAVAILABLE" },
    { statusCode: 404, code: "NOT_FOUND" },
    { statusCode: 409, code: "INVALID_WORKFLOW_STATE" },
    { statusCode: 409, code: "ENCOUNTER_COMPLETED" },
  ])("does not write when encounter access is denied: %j", async (denial) => {
    const { tx } = prepare();
    mocks.writable.mockRejectedValue(
      new ServiceError("Unavailable visit.", denial.statusCode, denial.code)
    );
    await expect(
      createClinicalNote({ encounterId, actor, note: { content: "Note" } })
    ).rejects.toMatchObject(denial);
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("propagates an audit failure so the transaction is not acknowledged", async () => {
    const { tx } = prepare();
    const insert = tx.insert.getMockImplementation()!;
    tx.insert.mockImplementation((table: unknown) => {
      if (table === auditLog) throw new Error("Audit unavailable.");
      return insert(table);
    });
    await expect(
      createClinicalNote({ encounterId, actor, note: { content: "Note" } })
    ).rejects.toThrow("Audit unavailable.");
  });
});
