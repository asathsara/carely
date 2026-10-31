import { describe, expect, it } from "vitest";
import { bookAppointmentSchema } from "@/lib/schemas/booking";

const input = {
  doctorId: "11111111-1111-4111-8111-111111111111",
  patientId: "22222222-2222-4222-8222-222222222222",
  date: "2028-02-29",
};

describe("Booking input", () => {
  it("accepts a leap day", () => {
    expect(bookAppointmentSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    "2026-02-29",
    "2026-02-30",
    "2026-04-31",
    "2026-00-10",
    "2026-13-01",
    "2026-10-00",
    "2026-1-01",
    "2026-10-31T00:00:00Z",
    "0000-01-01",
    "invalid",
  ])("rejects an invalid calendar date: %s", (date) => {
    expect(bookAppointmentSchema.safeParse({ ...input, date }).success).toBe(false);
  });

  it.each(["doctorId", "patientId"])("rejects an invalid %s", (field) => {
    expect(
      bookAppointmentSchema.safeParse({ ...input, [field]: "invalid" }).success
    ).toBe(false);
  });
});
