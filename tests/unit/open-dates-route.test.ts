import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), getOpenDates: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/services/booking", () => ({
  getOpenDatesForDoctor: mocks.getOpenDates,
  BookingServiceError: class extends Error {
    constructor(
      message: string,
      public statusCode: number,
      public code: string
    ) {
      super(message);
    }
  },
}));

import { GET } from "@/app/api/appointments/open-dates/route";
import { BookingServiceError } from "@/lib/services/booking";

const doctorId = "11111111-1111-4111-8111-111111111111";
const result = {
  doctorId,
  doctorName: "Test Doctor",
  specialtyName: "General Medicine",
  dates: [
    {
      date: "2026-10-31",
      dayOfWeek: 6,
      startTime: "09:00:00",
      endTime: "12:00:00",
      maxPatients: 10,
      bookedCount: 3,
      availableCount: 7,
    },
  ],
};

function request(query = `doctorId=${doctorId}`) {
  return new Request(`http://localhost/api/appointments/open-dates?${query}`, {
    headers: { cookie: "test-session" },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "patient-user", role: "patient" } });
  mocks.getOpenDates.mockResolvedValue(result);
});

describe("Open dates API", () => {
  it("requires authentication before processing the query", async () => {
    mocks.getSession.mockResolvedValue(null);
    const response = await GET(request(""));
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.getOpenDates).not.toHaveBeenCalled();
  });

  it.each(["patient", "receptionist", "admin"])(
    "allows %s to discover dates",
    async (role) => {
      mocks.getSession.mockResolvedValue({ user: { id: "allowed-user", role } });
      const req = request();
      const response = await GET(req);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(result);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(mocks.getSession).toHaveBeenCalledWith({ headers: req.headers });
      expect(mocks.getOpenDates).toHaveBeenCalledWith(doctorId);
    }
  );

  it.each(["doctor", "nurse", "pharmacist", "unknown"])(
    "rejects the %s role",
    async (role) => {
      mocks.getSession.mockResolvedValue({ user: { id: "other-user", role } });
      expect((await GET(request())).status).toBe(403);
      expect(mocks.getOpenDates).not.toHaveBeenCalled();
    }
  );

  it("rejects a banned account with an otherwise allowed role", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "banned-user", role: "patient", banned: true },
    });
    expect((await GET(request())).status).toBe(403);
    expect(mocks.getOpenDates).not.toHaveBeenCalled();
  });

  it.each([
    "",
    "doctorId=",
    "doctorId=invalid",
    `doctorId=${doctorId}&doctorId=${doctorId}`,
  ])("rejects missing, malformed or repeated doctorId: %s", async (query) => {
    const response = await GET(request(query));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_INPUT" });
    expect(mocks.getOpenDates).not.toHaveBeenCalled();
  });

  it("returns an empty date list when no sessions are open", async () => {
    mocks.getOpenDates.mockResolvedValue({ doctorId, dates: [] });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ doctorId, dates: [] });
  });

  it.each([
    { status: 404, code: "DOCTOR_NOT_FOUND" },
    { status: 400, code: "DOCTOR_INACTIVE" },
  ])("preserves service error $code", async ({ status, code }) => {
    mocks.getOpenDates.mockRejectedValue(
      new BookingServiceError("Doctor unavailable", status, code)
    );
    const response = await GET(request());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: "Doctor unavailable", code });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("hides database failure details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.getOpenDates.mockRejectedValue(
        new Error("private database connection details")
      );
      const response = await GET(request());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: "Unable to load available dates. Please try again.",
      });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    } finally {
      log.mockRestore();
    }
  });
});
