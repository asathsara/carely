import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ role: vi.fn(), queue: vi.fn(), receipt: vi.fn() }));
vi.mock("@/lib/auth-guard", () => ({ requireRole: mocks.role }));
vi.mock("@/lib/services/intake", () => ({
  getNurseQueue: mocks.queue,
  getNurseIntakeReceipt: mocks.receipt,
}));
import NurseVitalsPage from "@/app/(authenticated)/nurse/vitals/page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.role.mockResolvedValue({ user: { id: "signed-in-nurse", role: "nurse" } });
  mocks.queue.mockResolvedValue([]);
});
it("restores the URL selection and loads only session-authorized data", async () => {
  const page = await NurseVitalsPage({
    searchParams: Promise.resolve({ encounterId: "selected-id", userId: "forged" }),
  });
  expect(mocks.role).toHaveBeenCalledWith("nurse");
  expect(mocks.queue).toHaveBeenCalledWith({ userId: "signed-in-nurse", role: "nurse" });
  expect(page.props.selectedId).toBe("selected-id");
});
it("verifies a saved receipt on the server after reload", async () => {
  const receipt = { encounterId: "saved-id", recordedAt: "2026-11-14T04:00:00.000Z" };
  mocks.receipt.mockResolvedValue(receipt);
  const page = await NurseVitalsPage({
    searchParams: Promise.resolve({ receipt: "saved-id" }),
  });
  expect(mocks.receipt).toHaveBeenCalledWith("saved-id", {
    userId: "signed-in-nurse",
    role: "nurse",
  });
  expect(page.props.receipt).toEqual(receipt);
});
it("does not trust a forged receipt or expose server errors", async () => {
  mocks.receipt.mockRejectedValue(new Error("Private database information"));
  const page = await NurseVitalsPage({
    searchParams: Promise.resolve({ receipt: "forged" }),
  });
  expect(page.props.receipt).toBeNull();
  expect(page.props.initialError).toBe(
    "Saved confirmation is unavailable for this account and date."
  );
});
