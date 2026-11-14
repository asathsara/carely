import { describe, expect, it } from "vitest";
import { intakeVitalsSchema, recordIntakeSchema } from "@/lib/schemas/intake";

const valid = {
  vitals: { heartRate: 82, temperatureC: 36.9 },
  complaint: "Headache since yesterday.",
  preliminaryNote: "Patient is alert.",
};

describe("Intake input contract", () => {
  it("accepts typed measurements and bounded primitive extras and trims notes", () => {
    const input = {
      vitals: {
        bpSystolic: 128,
        bpDiastolic: 82,
        heartRate: 82,
        respiratoryRate: 18,
        temperatureC: 36.9,
        spo2: 97,
        weightKg: 68.3,
        heightCm: 170.5,
        additional: {
          glucose: 5.4,
          site: " left arm ",
          fasting: false,
          unavailable: null,
        },
      },
      complaint: "  Headache since yesterday. ",
      preliminaryNote: "  Patient is alert.  ",
    };
    expect(recordIntakeSchema.parse(input)).toEqual({
      ...input,
      vitals: {
        ...input.vitals,
        additional: { ...input.vitals.additional, site: "left arm" },
      },
      complaint: valid.complaint,
      preliminaryNote: valid.preliminaryNote,
    });
  });

  it.each([
    { vitals: {} },
    { vitals: { heartRate: null, additional: { unavailable: null } } },
    { complaint: "   " },
    { complaint: "x".repeat(2001) },
    { preliminaryNote: "" },
    { preliminaryNote: "x".repeat(5001) },
    { actor: { userId: "forged-author", role: "nurse" } },
    { recordedAt: "2020-01-01T00:00:00Z" },
    { encounterId: "other-encounter" },
    { nic: "excluded" },
    { allergies: "excluded" },
    { vitals: { heartRate: 82, recordedBy: "forged-author" } },
  ])("rejects missing data and unsupported fields: %j", async (override) => {
    expect(recordIntakeSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it.each([
    { heartRate: "82" },
    { heartRate: 0 },
    { heartRate: 301 },
    { heartRate: 82.5 },
    { heartRate: Number.NaN },
    { heartRate: Number.POSITIVE_INFINITY },
    { respiratoryRate: 101 },
    { bpSystolic: 128 },
    { bpDiastolic: 82 },
    { bpSystolic: 80, bpDiastolic: 80 },
    { bpSystolic: 70, bpDiastolic: 82 },
    { bpSystolic: 301, bpDiastolic: 82 },
    { bpSystolic: 128, bpDiastolic: 201 },
    { temperatureC: 24.9 },
    { temperatureC: 45.1 },
    { temperatureC: 36.95 },
    { spo2: -1 },
    { spo2: 101 },
    { weightKg: 0 },
    { weightKg: 500.1 },
    { weightKg: 68.35 },
    { heightCm: 9.9 },
    { heightCm: 300.1 },
  ])("rejects invalid or unsupported measurement precision: %j", (vitals) => {
    expect(intakeVitalsSchema.safeParse(vitals).success).toBe(false);
  });

  it("preserves legitimate zero and false extra measurements", () => {
    expect(intakeVitalsSchema.parse({ spo2: 0 })).toEqual({ spo2: 0 });
    expect(
      intakeVitalsSchema.parse({ additional: { glucose: 0, fasting: false } })
    ).toEqual({
      additional: { glucose: 0, fasting: false },
    });
  });

  it.each([
    { nested: { value: 5 } },
    { list: [1, 2] },
    { value: "x".repeat(201) },
    { value: " " },
    { value: Number.POSITIVE_INFINITY },
    { ["x".repeat(41)]: 5 },
    { "invalid key": 5 },
    { constructor: "unsupported" },
    Object.fromEntries([["__proto__", "unsupported"]]),
    { NIC: "unsupported" },
    { allergies: "unsupported" },
    { heartRate: -500 },
    Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`measure${i}`, i])),
    Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`measure${i}`, "é".repeat(200)])
    ),
  ])("bounds additional measurements and rejects reserved keys: %j", (additional) => {
    expect(
      recordIntakeSchema.safeParse({ ...valid, vitals: { heartRate: 82, additional } })
        .success
    ).toBe(false);
  });
});
