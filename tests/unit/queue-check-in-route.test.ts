import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), checkIn: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/services/queue", () => ({ checkInAppointment: mocks.checkIn }));

import { POST } from "@/app/api/queue/check-in/route";
import { ServiceError } from "@/lib/services/service-error";

const appointmentId = "11111111-1111-4111-8111-111111111111";
function request(body: unknown = { appointmentId }) {
  return new Request("http://localhost/api/queue/check-in", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: "test-session" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({
    user: { id: "reception-user", role: "receptionist" },
  });
  mocks.checkIn.mockResolvedValue({
    id: "queue-entry",
    appointmentId,
    status: "waiting",
  });
});

describe("POST /api/queue/check-in", () => {
  it("accepts a receptionist check-in using the session actor", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      entry: { id: "queue-entry", appointmentId, status: "waiting" },
    });
    expect(mocks.checkIn).toHaveBeenCalledWith({
      appointmentId,
      actor: { userId: "reception-user", role: "receptionist" },
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each([
    null,
    { user: { id: "patient-user", role: "patient" } },
    { user: { id: "nurse-user", role: "nurse" } },
  ])("rejects an unauthorised session: %j", async (session) => {
    mocks.getSession.mockResolvedValue(session);
    expect((await POST(request())).status).toBe(session ? 403 : 401);
    expect(mocks.checkIn).not.toHaveBeenCalled();
  });

  it.each([{}, { appointmentId: "not-a-uuid" }, { appointmentId, extra: true }])(
    "rejects invalid input: %j",
    async (body) => {
      expect((await POST(request(body))).status).toBe(400);
      expect(mocks.checkIn).not.toHaveBeenCalled();
    }
  );

  it("keeps service conflict responses intact", async () => {
    mocks.checkIn.mockRejectedValue(
      new ServiceError(
        "Only today's booked appointments can be checked in.",
        409,
        "APPOINTMENT_CLOSED"
      )
    );
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "APPOINTMENT_CLOSED" });
  });
});
