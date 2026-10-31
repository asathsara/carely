import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  list: vi.fn(),
  profile: vi.fn(),
  book: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/services/patient", () => ({ getOrCreatePatientForUser: mocks.profile }));
vi.mock("@/lib/services/patient-booking", () => ({ getPatientAppointments: mocks.list }));
vi.mock("@/lib/services/booking", () => ({
  bookAppointment: mocks.book,
  cancelAppointment: mocks.cancel,
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

import { GET, POST } from "@/app/api/patient/appointments/route";
import { POST as CANCEL } from "@/app/api/appointments/[id]/cancel/route";
import { redirect } from "next/navigation";

const doctorId = "11111111-1111-4111-8111-111111111111";
const patientId = "22222222-2222-4222-8222-222222222222";
const appointmentId = "33333333-3333-4333-8333-333333333333";
const input = { doctorId, date: "2026-11-07" };
const context = { params: Promise.resolve({ id: appointmentId }) };

function request(method = "POST", body: unknown = input, origin?: string) {
  return new Request(
    "http://localhost/api/patient/appointments?patientId=foreign-patient",
    {
      method,
      headers: {
        "Content-Type": "application/json",
        cookie: "test-session",
        ...(origin ? { Origin: origin } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    }
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "patient-user", role: "patient" } });
  mocks.profile.mockResolvedValue({ id: patientId });
  mocks.list.mockResolvedValue([]);
  mocks.book.mockResolvedValue({
    success: true,
    appointment: { id: appointmentId },
    appointmentNo: 1,
  });
  mocks.cancel.mockResolvedValue({ success: true });
});

describe("Patient appointment endpoints", () => {
  it("lets Next.js handle framework control-flow errors", async () => {
    let redirectError: unknown;
    try {
      redirect("/login");
    } catch (error) {
      redirectError = error;
    }
    mocks.list.mockRejectedValue(redirectError);
    await expect(GET(request("GET"))).rejects.toBe(redirectError);
  });
  it("requires a session for reading, booking and cancellation", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await GET(request("GET"))).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    expect((await CANCEL(request(), context)).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.book).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it.each(["doctor", "receptionist", "admin", "nurse", "pharmacist"])(
    "blocks %s from the patient-only list and booking endpoints",
    async (role) => {
      mocks.getSession.mockResolvedValue({ user: { id: "staff-user", role } });
      expect((await GET(request("GET"))).status).toBe(403);
      expect((await POST(request())).status).toBe(403);
      expect(mocks.list).not.toHaveBeenCalled();
      expect(mocks.book).not.toHaveBeenCalled();
    }
  );

  it("reads only the session user's appointments and disables caching", async () => {
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ appointments: [] });
    expect(mocks.list).toHaveBeenCalledWith("patient-user");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("derives patient and actor from the session when saving a booking", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.profile).toHaveBeenCalledWith("patient-user");
    expect(mocks.book).toHaveBeenCalledWith({
      ...input,
      patientId,
      actor: { userId: "patient-user", role: "patient" },
    });
    expect(await response.json()).toMatchObject({ success: true, appointmentNo: 1 });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each([
    { ...input, patientId },
    { ...input, actor: { userId: "victim", role: "admin" } },
    { ...input, appointmentNo: 99 },
    { ...input, source: "reception" },
    { ...input, date: "2026-02-30" },
    { ...input, doctorId: "invalid" },
  ])("rejects invalid or forged booking fields: %j", async (body) => {
    expect((await POST(request("POST", body))).status).toBe(400);
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.book).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/patient/appointments", {
        method: "POST",
        body: "{",
      })
    );
    expect(response.status).toBe(400);
    expect(mocks.profile).not.toHaveBeenCalled();
  });

  it("preserves booking capacity conflicts", async () => {
    mocks.book.mockResolvedValue({
      success: false,
      code: "SESSION_FULL",
      statusCode: 409,
      error: "Session is fully booked",
    });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "SESSION_FULL" });
  });

  it("rejects banned sessions and cross-origin mutations", async () => {
    expect((await POST(request("POST", input, "https://other.example"))).status).toBe(
      403
    );
    expect(
      (await CANCEL(request("POST", input, "https://other.example"), context)).status
    ).toBe(403);
    mocks.getSession.mockResolvedValue({
      user: { id: "banned", role: "patient", banned: true },
    });
    expect((await GET(request("GET"))).status).toBe(403);
    expect((await POST(request())).status).toBe(403);
    expect((await CANCEL(request(), context)).status).toBe(403);
    expect(mocks.book).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it.each(["patient", "receptionist", "admin"])(
    "passes the %s session actor to cancellation",
    async (role) => {
      mocks.getSession.mockResolvedValue({ user: { id: "allowed-user", role } });
      const response = await CANCEL(request(), context);
      expect(response.status).toBe(200);
      expect(mocks.cancel).toHaveBeenCalledWith({
        appointmentId,
        actor: { userId: "allowed-user", role },
      });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  );

  it.each(["doctor", "nurse", "pharmacist"])("rejects %s cancellations", async (role) => {
    mocks.getSession.mockResolvedValue({ user: { id: "staff-user", role } });
    expect((await CANCEL(request(), context)).status).toBe(403);
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it("preserves cancellation ownership and closed-status rejections", async () => {
    for (const statusCode of [400, 404, 409]) {
      mocks.cancel.mockResolvedValue({
        success: false,
        statusCode,
        error: "Unavailable",
      });
      expect((await CANCEL(request(), context)).status).toBe(statusCode);
    }
  });

  it("does not expose database errors through any endpoint", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const error = new Error("private database credentials");
      mocks.list.mockRejectedValue(error);
      mocks.book.mockRejectedValue(error);
      mocks.cancel.mockRejectedValue(error);
      for (const response of [
        await GET(request("GET")),
        await POST(request()),
        await CANCEL(request(), context),
      ]) {
        expect(response.status).toBe(500);
        expect(await response.text()).not.toContain("credentials");
      }
    } finally {
      log.mockRestore();
    }
  });
});
