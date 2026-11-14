import { describe, expect, it } from "vitest";
import { createPrescriptionSchema } from "@/lib/schemas/prescription";

const medicineId = "11111111-1111-4111-8111-111111111111";
const valid = {
  items: [
    {
      medicineId,
      dosage: " 500 mg ",
      frequency: " Twice daily ",
      durationDays: 7,
      quantity: 14,
      instructions: " After meals ",
    },
  ],
};

describe("prescription schema", () => {
  it("accepts a bounded prescription and normalizes text", () => {
    expect(createPrescriptionSchema.parse(valid)).toEqual({
      items: [
        {
          medicineId,
          dosage: "500 mg",
          frequency: "Twice daily",
          durationDays: 7,
          quantity: 14,
          instructions: "After meals",
        },
      ],
    });
  });

  it.each([
    {},
    { items: [] },
    { items: [{ ...valid.items[0], medicineId: "invalid" }] },
    { items: [{ ...valid.items[0], durationDays: 0 }] },
    { items: [{ ...valid.items[0], quantity: 0 }] },
    { items: [{ ...valid.items[0], dosage: "" }] },
    { items: [{ ...valid.items[0], doctorId: "forged" }] },
    { items: [valid.items[0], { ...valid.items[0] }] },
  ])("rejects invalid, forged, or duplicate prescription input: %j", (input) => {
    expect(createPrescriptionSchema.safeParse(input).success).toBe(false);
  });
});
