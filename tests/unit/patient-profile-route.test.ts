import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/lib/services/patient", () => ({ updateOwnPatientProfile: mocks.update }));
import { PATCH } from "@/app/api/patient/profile/route";
function request(body: unknown, origin?: string) {
  return new Request("http://localhost/api/patient/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "patient-user", role: "patient" } });
  mocks.update.mockResolvedValue({ phone: "0773333333", address: "Unchanged address" });
});
describe("Patient profile PATCH", () => {
  it("passes only the supplied field and the server actor to the service", async () => {
    const response = await PATCH(request({ phone: "0773333333" }));
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      { phone: "0773333333" },
      { userId: "patient-user", role: "patient" }
    );
    expect(await response.json()).toMatchObject({
      patient: { address: "Unchanged address" },
    });
  });
  it.each([
    {},
    { email: "other@test.invalid" },
    { phone: "0773333333", userId: "other" },
    "{invalid",
  ])("rejects an empty, forbidden or malformed update: %j", async (body) => {
    expect((await PATCH(request(body))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects cross-origin and unauthorized callers before mutation", async () => {
    expect(
      (await PATCH(request({ phone: "0773333333" }, "https://other.example"))).status
    ).toBe(403);
    mocks.session.mockResolvedValue(null);
    expect((await PATCH(request({ phone: "0773333333" }))).status).toBe(401);
    mocks.session.mockResolvedValue({ user: { id: "reception", role: "receptionist" } });
    expect((await PATCH(request({ phone: "0773333333" }))).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
