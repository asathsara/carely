import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAvailability: vi.fn(),
  saveAvailability: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/services/availability", () => ({
  getDoctorAvailability: mocks.getAvailability,
  saveDoctorAvailability: mocks.saveAvailability,
  AvailabilityServiceError: class extends Error {
    constructor(
      message: string,
      public statusCode: number
    ) {
      super(message);
    }
  },
}));

import { GET, POST } from "@/app/api/doctor/availability/route";
import { AvailabilityServiceError } from "@/lib/services/availability";

const input = {
  sessions: [
    {
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "12:00",
      maxPatients: 10,
      isActive: true,
    },
  ],
};

function request(method: "GET" | "POST", body: unknown = input) {
  return new Request("http://localhost/api/doctor/availability", {
    method,
    headers: { "Content-Type": "application/json", cookie: "test-session" },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({
    user: { id: "signed-in-doctor", role: "doctor" },
  });
  mocks.getAvailability.mockResolvedValue([]);
  mocks.saveAvailability.mockResolvedValue(input.sessions);
});

describe("Doctor availability API", () => {
  it.each(["GET", "POST"] as const)(
    "rejects unauthenticated %s requests",
    async (method) => {
      mocks.getSession.mockResolvedValue(null);
      const response = await (method === "GET" ? GET : POST)(request(method));
      expect(response.status).toBe(401);
      expect(mocks.getAvailability).not.toHaveBeenCalled();
      expect(mocks.saveAvailability).not.toHaveBeenCalled();
    }
  );

  it.each(["patient", "receptionist", "nurse", "pharmacist", "admin"])(
    "blocks the %s role from reading and saving schedules",
    async (role) => {
      mocks.getSession.mockResolvedValue({ user: { id: "other-user", role } });
      expect((await GET(request("GET"))).status).toBe(403);
      expect((await POST(request("POST"))).status).toBe(403);
      expect(mocks.getAvailability).not.toHaveBeenCalled();
      expect(mocks.saveAvailability).not.toHaveBeenCalled();
    }
  );

  it("loads only the signed-in doctor's schedule and disables caching", async () => {
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ availability: [] });
    expect(mocks.getAvailability).toHaveBeenCalledWith("signed-in-doctor");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("saves validated sessions under the signed-in identity", async () => {
    const response = await POST(request("POST"));
    expect(response.status).toBe(200);
    expect(mocks.saveAvailability).toHaveBeenCalledWith("signed-in-doctor", input);
    expect(await response.json()).toEqual({ availability: input.sessions });
  });

  it("rejects malformed JSON without writing", async () => {
    const response = await POST(
      new Request("http://localhost/api/doctor/availability", {
        method: "POST",
        body: "{",
      })
    );
    expect(response.status).toBe(400);
    expect(mocks.saveAvailability).not.toHaveBeenCalled();
  });

  it.each([
    { sessions: [{ ...input.sessions[0], endTime: "08:00" }] },
    { sessions: [{ ...input.sessions[0], maxPatients: 0 }] },
    { sessions: [input.sessions[0], input.sessions[0]] },
    { ...input, doctorId: "victim-doctor" },
  ])("rejects invalid or forged input without writing: %j", async (body) => {
    expect((await POST(request("POST", body))).status).toBe(400);
    expect(mocks.saveAvailability).not.toHaveBeenCalled();
  });

  it.each([403, 404])(
    "preserves the service's %s rejection for both methods",
    async (status) => {
      mocks.getAvailability.mockRejectedValue(
        new AvailabilityServiceError("Doctor unavailable", status)
      );
      mocks.saveAvailability.mockRejectedValue(
        new AvailabilityServiceError("Doctor unavailable", status)
      );
      expect((await GET(request("GET"))).status).toBe(status);
      expect((await POST(request("POST"))).status).toBe(status);
    }
  );

  it("does not expose database error details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.saveAvailability.mockRejectedValue(
        new Error("private database connection details")
      );
      const response = await POST(request("POST"));
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("private database");
    } finally {
      log.mockRestore();
    }
  });
});
