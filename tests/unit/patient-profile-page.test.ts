import { beforeEach, expect, it, vi } from "vitest";
import { savedPatientProfile } from "../helpers/patient-profile";
const mocks = vi.hoisted(() => ({ role: vi.fn(), profile: vi.fn() }));
vi.mock("@/lib/auth-guard", () => ({ requireRole: mocks.role }));
vi.mock("@/lib/services/patient", () => ({ getOwnPatientProfile: mocks.profile }));
import PatientProfilePage from "@/app/(authenticated)/patient/profile/page";
beforeEach(() => {
  mocks.role.mockResolvedValue({ user: { id: "signed-in-patient", role: "patient" } });
  mocks.profile.mockResolvedValue(savedPatientProfile);
});
it("loads the signed-in patient's stored profile before rendering the settings", async () => {
  const page = await PatientProfilePage();
  expect(mocks.role).toHaveBeenCalledWith("patient");
  expect(mocks.profile).toHaveBeenCalledWith({
    userId: "signed-in-patient",
    role: "patient",
  });
  expect(page.props.initialProfile).toEqual(savedPatientProfile);
});
