import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), record: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/services/intake", () => ({ recordIntake: mocks.record }));

import { POST } from "@/app/api/encounters/[id]/intake/route";
import { redirect } from "next/navigation";
import { ServiceError } from "@/lib/services/service-error";

const encounterId = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id: encounterId }) };
const input = {
  vitals: { heartRate: 82, temperatureC: 36.9 },
  complaint: "Headache since yesterday.",
  preliminaryNote: "Patient is alert.",
};
const result = {
  encounterId,
  queueEntryId: "queue-id",
  status: "intake_done",
  vitalsId: "vitals-id",
  preliminaryNoteId: "note-id",
  recordedAt: "2026-11-14T10:00:00.000Z",
};

function request(body: unknown = input, origin?: string) {
  return new Request(`http://localhost/api/encounters/${encounterId}/intake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: "test-session",
      ...(origin ? { origin } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "nurse-user", role: "nurse" } });
  mocks.record.mockResolvedValue(result);
});

describe("POST /api/encounters/:id/intake", () => {
  it("saves using the URL encounter ID and server-session nurse", async () => {
    const req = request(input, "http://localhost");
    const response = await POST(req, context);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ intake: result });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.getSession).toHaveBeenCalledWith({ headers: req.headers });
    expect(mocks.record).toHaveBeenCalledWith({
      encounterId,
      intake: input,
      actor: { userId: "nurse-user", role: "nurse" },
    });
  });

  it.each([
    { session: null, status: 401 },
    ...["patient", "receptionist", "doctor", "pharmacist", "admin"].map((role) => ({
      session: { user: { id: "other-user", role } },
      status: 403,
    })),
    { session: { user: { id: "nurse-user", role: "nurse", banned: true } }, status: 403 },
  ])("rejects unauthorized sessions: %j", async ({ session, status }) => {
    mocks.getSession.mockResolvedValue(session);
    const response = await POST(request(), context);
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("rejects cross-origin writes before authentication or mutation", async () => {
    const response = await POST(request(input, "https://other.example"), context);
    expect(response.status).toBe(403);
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("rejects malformed URL identifiers", async () => {
    expect(
      (await POST(request(), { params: Promise.resolve({ id: "invalid" }) })).status
    ).toBe(400);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it.each([
    "{invalid",
    null,
    {},
    { ...input, vitals: { spo2: 101 } },
    { ...input, recordedBy: "other-nurse" },
    { ...input, recordedAt: "2020-01-01" },
    { ...input, vitals: { heartRate: 82, nic: "excluded" } },
  ])("rejects malformed, invalid or forged records: %j", async (body) => {
    const response = await POST(request(body), context);
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it.each([
    { statusCode: 403, code: "ACCOUNT_UNAVAILABLE" },
    { statusCode: 404, code: "NOT_FOUND" },
    { statusCode: 409, code: "INVALID_WORKFLOW_STATE" },
    { statusCode: 409, code: "ENCOUNTER_COMPLETED" },
    { statusCode: 409, code: "QUEUE_STATE_CONFLICT" },
  ])("preserves service denials: %j", async ({ statusCode, code }) => {
    mocks.record.mockRejectedValue(
      new ServiceError("Unavailable visit.", statusCode, code)
    );
    const response = await POST(request(), context);
    expect(response.status).toBe(statusCode);
    expect(await response.json()).toEqual({ error: "Unavailable visit.", code });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps clinical values out of error responses and logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.record.mockRejectedValue(new Error(`Database failed for ${input.complaint}`));
      const response = await POST(request(), context);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: "Unable to save intake records. Please try again.",
      });
      expect(log).toHaveBeenCalledExactlyOnceWith("Nurse intake save failed.");
    } finally {
      log.mockRestore();
    }
  });

  it("rethrows Next.js control-flow errors", async () => {
    let redirectError: unknown;
    try {
      redirect("/login");
    } catch (error) {
      redirectError = error;
    }
    mocks.record.mockRejectedValue(redirectError);
    await expect(POST(request(), context)).rejects.toBe(redirectError);
  });
});
