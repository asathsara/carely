import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), open: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/services/consultation", () => ({ openConsultation: mocks.open }));

import { POST } from "@/app/api/doctor/queue/[entryId]/open/route";
import { redirect } from "next/navigation";
import { ServiceError } from "@/lib/services/service-error";

const entryId = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ entryId }) };
const opened = {
  encounterId: "encounter-id",
  queueEntryId: entryId,
  status: "with_doctor",
  calledAt: "2026-11-14T10:00:00.000Z",
};

function request(body = "{}", origin?: string) {
  return new Request(`http://localhost/api/doctor/queue/${entryId}/open`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: "test-session",
      ...(origin ? { origin } : {}),
    },
    ...(body ? { body } : {}),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "doctor-user", role: "doctor" } });
  mocks.open.mockResolvedValue(opened);
});

describe("POST /api/doctor/queue/:entryId/open", () => {
  it.each(["", "{}"])(
    "opens using the URL entry and session doctor with body %j",
    async (body) => {
      const req = request(body, "http://localhost");
      const response = await POST(req, context);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ consultation: opened });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(mocks.getSession).toHaveBeenCalledWith({ headers: req.headers });
      expect(mocks.open).toHaveBeenCalledWith({
        entryId,
        actor: { userId: "doctor-user", role: "doctor" },
      });
    }
  );

  it.each([
    { session: null, status: 401 },
    ...["patient", "receptionist", "nurse", "pharmacist", "admin"].map((role) => ({
      session: { user: { id: "other-user", role } },
      status: 403,
    })),
    {
      session: { user: { id: "doctor-user", role: "doctor", banned: true } },
      status: 403,
    },
  ])("rejects unauthorized sessions: %j", async ({ session, status }) => {
    mocks.getSession.mockResolvedValue(session);
    const response = await POST(request(), context);
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("rejects cross-origin writes before authentication", async () => {
    expect((await POST(request("{}", "https://other.example"), context)).status).toBe(
      403
    );
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("rejects invalid queue IDs", async () => {
    expect(
      (await POST(request(), { params: Promise.resolve({ entryId: "invalid" }) })).status
    ).toBe(400);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it.each([
    "{invalid",
    "null",
    "[]",
    "true",
    JSON.stringify({ actor: { userId: "forged", role: "doctor" } }),
    JSON.stringify({ entryId: "other-entry" }),
    JSON.stringify({ status: "completed" }),
    JSON.stringify({ calledAt: "2020-01-01T00:00:00Z" }),
  ])("rejects malformed or unsupported request bodies: %s", async (body) => {
    const response = await POST(request(body), context);
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it.each([
    { statusCode: 403, code: "ACCOUNT_UNAVAILABLE" },
    { statusCode: 404, code: "NOT_FOUND" },
    { statusCode: 409, code: "INVALID_WORKFLOW_STATE" },
    { statusCode: 409, code: "ENCOUNTER_COMPLETED" },
    { statusCode: 409, code: "APPOINTMENT_CLOSED" },
    { statusCode: 409, code: "QUEUE_STATE_CONFLICT" },
  ])("preserves service denials: %j", async ({ statusCode, code }) => {
    mocks.open.mockRejectedValue(
      new ServiceError("Unavailable visit.", statusCode, code)
    );
    const response = await POST(request(), context);
    expect(response.status).toBe(statusCode);
    expect(await response.json()).toEqual({ error: "Unavailable visit.", code });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps unexpected error details out of responses and logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.open.mockRejectedValue(new Error("Private database details"));
      const response = await POST(request(), context);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: "Unable to open the consultation. Please try again.",
      });
      expect(log).toHaveBeenCalledExactlyOnceWith("Consultation opening failed.");
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
    mocks.open.mockRejectedValue(redirectError);
    await expect(POST(request(), context)).rejects.toBe(redirectError);
  });
});
