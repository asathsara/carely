import { describe, expect, it } from "vitest";
import {
  patientProfileUpdateSchema,
  receptionistPatientUpdateSchema,
} from "@/lib/schemas/patient-update";

describe.each([
  ["patient", patientProfileUpdateSchema],
  ["receptionist", receptionistPatientUpdateSchema],
] as const)("%s partial profile updates", (_, schema) => {
  it("preserves omitted fields and rejects empty or undefined-only updates", () => {
    expect(schema.parse({ phone: " 0773333333 " })).toEqual({ phone: "0773333333" });
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ phone: undefined }).success).toBe(false);
  });
  it("clears only fields explicitly supplied as blank or null", () => {
    expect(schema.parse({ address: "  " })).toEqual({ address: null });
    expect(schema.parse({ emergencyContactPhone: null })).toEqual({
      emergencyContactPhone: null,
    });
  });
  it.each(["nic", "allergies", "patientNo", "userId", "email", "role"])(
    "rejects forbidden field %s",
    (field) => {
      expect(
        schema.safeParse({ phone: "0773333333", [field]: "forbidden" }).success
      ).toBe(false);
    }
  );
});
it("a receptionist name-only edit preserves optional demographic and contact fields", () => {
  expect(receptionistPatientUpdateSchema.parse({ fullName: "Corrected Name" })).toEqual({
    fullName: "Corrected Name",
  });
});
it.each(["fullName", "gender", "dateOfBirth"])("patients cannot edit %s", (field) => {
  expect(patientProfileUpdateSchema.safeParse({ [field]: "forbidden" }).success).toBe(
    false
  );
});
