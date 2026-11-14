import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), queue: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/services/consultation", () => ({
  getDoctorConsultationQueue: mocks.queue,
}));
import { GET } from "@/app/api/doctor/queue/route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "doctor-user", role: "doctor" } });
  mocks.queue.mockResolvedValue([]);
});
it("derives the doctor from the session, ignoring query impersonation", async () => {
  const response = await GET(
    new Request("http://localhost/api/doctor/queue?doctorId=foreign&date=2099-01-01")
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ entries: [] });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(mocks.queue).toHaveBeenCalledWith({ userId: "doctor-user", role: "doctor" });
});
it.each(["patient", "nurse", "receptionist", "pharmacist", "admin"])(
  "denies the %s role",
  async (role) => {
    mocks.getSession.mockResolvedValue({ user: { id: "other-user", role } });
    expect((await GET(new Request("http://localhost/api/doctor/queue"))).status).toBe(
      403
    );
    expect(mocks.queue).not.toHaveBeenCalled();
  }
);
it("requires a session", async () => {
  mocks.getSession.mockResolvedValue(null);
  expect((await GET(new Request("http://localhost/api/doctor/queue"))).status).toBe(401);
});
