import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: mocks }));

import { bookAppointment } from "@/lib/services/booking";

const input = {
  doctorId: "11111111-1111-4111-8111-111111111111",
  patientId: "22222222-2222-4222-8222-222222222222",
  date: "2026-11-07",
  actor: { userId: "signed-in-user", role: "patient" },
};

beforeEach(() => vi.resetAllMocks());

describe("Booking transaction errors", () => {
  it("returns a retryable conflict when the token uniqueness backstop fires", async () => {
    mocks.transaction.mockRejectedValue(
      new Error("Query failed", {
        cause: {
          code: "23505",
          constraint_name: "appointment_doctor_date_no_unique",
        },
      })
    );
    expect(await bookAppointment(input)).toEqual({
      success: false,
      code: "TOKEN_CONFLICT",
      statusCode: 409,
      error: "Token slot conflict, please retry",
    });
  });

  it("propagates unrelated database errors instead of misreporting capacity", async () => {
    const error = new Error("Query failed", {
      cause: { code: "23505", constraint_name: "another_constraint" },
    });
    mocks.transaction.mockRejectedValue(error);
    await expect(bookAppointment(input)).rejects.toBe(error);
  });

  it("validates calendar dates before opening a transaction", async () => {
    expect(await bookAppointment({ ...input, date: "2026-02-30" })).toMatchObject({
      success: false,
      code: "INVALID_INPUT",
      statusCode: 400,
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
