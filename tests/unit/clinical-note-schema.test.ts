import { describe, expect, it } from "vitest";
import {
  clinicalNoteEncounterParamsSchema,
  createClinicalNoteSchema,
} from "@/lib/schemas/clinical-note";

describe("clinical note schemas", () => {
  it("accepts a non-empty bounded note and trims its content", () => {
    expect(
      createClinicalNoteSchema.parse({ content: "  Examination is normal.  " })
    ).toEqual({
      content: "Examination is normal.",
    });
  });

  it.each([
    {},
    { content: "" },
    { content: "   " },
    { content: 42 },
    { content: "a".repeat(5001) },
    { content: "Note", authorId: "forged" },
  ])("rejects invalid or forged note input: %j", (input) => {
    expect(createClinicalNoteSchema.safeParse(input).success).toBe(false);
  });

  it("requires an encounter UUID", () => {
    expect(
      clinicalNoteEncounterParamsSchema.safeParse({
        id: "11111111-1111-4111-8111-111111111111",
      }).success
    ).toBe(true);
    expect(clinicalNoteEncounterParamsSchema.safeParse({ id: "invalid" }).success).toBe(
      false
    );
  });
});
