import { describe, expect, it } from "vitest";
import {
  createWalkInPatientSchema,
  patientSearchSchema,
  receptionBookingSchema,
} from "@/lib/schemas/reception";

describe("Reception patient validation", () => {
  it("accepts a minimal walk-in patient with only a full name", () => {
    expect(createWalkInPatientSchema.parse({ fullName: "Saman Perera" })).toMatchObject({
      fullName: "Saman Perera",
      confirmDuplicate: false,
    });
  });

  it("normalizes blank optional demographics and rejects invalid dates", () => {
    expect(
      createWalkInPatientSchema.parse({
        fullName: "Saman Perera",
        phone: "  ",
        address: " ",
      })
    ).toMatchObject({ phone: undefined, address: undefined });
    expect(
      createWalkInPatientSchema.safeParse({
        fullName: "Saman Perera",
        dateOfBirth: "2026-02-30",
      }).success
    ).toBe(false);
  });

  it("rejects an empty name and unexpected registration fields", () => {
    expect(createWalkInPatientSchema.safeParse({ fullName: " " }).success).toBe(false);
    expect(
      createWalkInPatientSchema.safeParse({
        fullName: "Saman Perera",
        nic: "123456789V",
      }).success
    ).toBe(false);
  });

  it("requires a useful, bounded search query", () => {
    expect(patientSearchSchema.safeParse({ q: "PAT-000001" }).success).toBe(true);
    expect(patientSearchSchema.safeParse({ q: " " }).success).toBe(false);
    expect(patientSearchSchema.safeParse({ q: "x".repeat(121) }).success).toBe(false);
  });

  it("uses the same strict booking contract as the token booking engine", () => {
    expect(
      receptionBookingSchema.safeParse({
        patientId: "6d202d79-3fb2-48c7-9aeb-66ca3b986cef",
        doctorId: "8ffabf33-0ad8-45cc-8da1-053eef50e2e1",
        date: "2026-11-07",
      }).success
    ).toBe(true);
    expect(
      receptionBookingSchema.safeParse({
        patientId: "6d202d79-3fb2-48c7-9aeb-66ca3b986cef",
        doctorId: "8ffabf33-0ad8-45cc-8da1-053eef50e2e1",
        date: "2026-11-07",
        bookedBy: "client-controlled",
      }).success
    ).toBe(false);
  });
});
