import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), getQueue: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/services/intake", () => ({ getNurseQueue: mocks.getQueue }));

import { GET } from "@/app/api/nurse/queue/route";
import { redirect } from "next/navigation";
import { ServiceError } from "@/lib/services/service-error";

function request(query = "") {
  return new Request("http://localhost/api/nurse/queue" + query, {
    headers: { cookie: "test-session" },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "nurse-user", role: "nurse" } });
  mocks.getQueue.mockResolvedValue([]);
});

describe("GET /api/nurse/queue", () => {
  it("uses the session nurse and returns a non-cacheable queue", async () => {
    const entries = [{ id: "entry-id", encounterId: "encounter-id", status: "waiting" }];
    mocks.getQueue.mockResolvedValue(entries);
    const req = request("?date=2099-01-01&role=admin&userId=other-user");
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ entries });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.getSession).toHaveBeenCalledWith({ headers: req.headers });
    expect(mocks.getQueue).toHaveBeenCalledWith({ userId: "nurse-user", role: "nurse" });
  });

  it("returns an empty list when no patients await intake", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ entries: [] });
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
    const response = await GET(request());
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.getQueue).not.toHaveBeenCalled();
  });

  it("preserves account restrictions rechecked by the service", async () => {
    mocks.getQueue.mockRejectedValue(
      new ServiceError("Your account is unavailable.", 403, "ACCOUNT_UNAVAILABLE")
    );
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "ACCOUNT_UNAVAILABLE" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("does not expose or log database error details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.getQueue.mockRejectedValue(new Error("private database details"));
      const response = await GET(request());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: "Unable to load the intake queue.",
      });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(log).toHaveBeenCalledExactlyOnceWith("Nurse intake queue request failed.");
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
    mocks.getQueue.mockRejectedValue(redirectError);
    await expect(GET(request())).rejects.toBe(redirectError);
  });
});
