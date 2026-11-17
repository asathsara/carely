import { describe, expect, it } from "vitest";
import {
  doctorPatientHistoryParamsSchema,
  doctorVisitParamsSchema,
} from "@/lib/schemas/record-review";

const id = "11111111-1111-4111-8111-111111111111";

describe("record review schemas", () => {
  it("accepts UUID route identifiers", () => {
    expect(doctorVisitParamsSchema.safeParse({ queueEntryId: id }).success).toBe(true);
    expect(doctorPatientHistoryParamsSchema.safeParse({ patientId: id }).success).toBe(
      true
    );
  });

  it("rejects malformed or extra route fields", () => {
    expect(doctorVisitParamsSchema.safeParse({ queueEntryId: "invalid" }).success).toBe(
      false
    );
    expect(
      doctorPatientHistoryParamsSchema.safeParse({ patientId: id, actor: "forged" })
        .success
    ).toBe(false);
  });
});
