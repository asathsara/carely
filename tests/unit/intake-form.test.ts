import { describe, expect, it } from "vitest";
import { intakeValidationMessages, parseIntakeForm } from "@/lib/intake-form";

function form() {
  const data = new FormData();
  data.set("complaint", "  Initial complaint.  ");
  data.set("preliminaryNote", "  Nursing observations.  ");
  data.set("heartRate", "82");
  return data;
}

describe("Nurse intake form conversion", () => {
  it("converts only entered measurements and trims clinical text", () => {
    const data = form();
    data.set("temperatureC", "36.9");
    data.set("weightKg", "");
    data.set("spo2", "0");
    const result = parseIntakeForm(data);
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data).toEqual({
        vitals: { heartRate: 82, temperatureC: 36.9, spo2: 0 },
        complaint: "Initial complaint.",
        preliminaryNote: "Nursing observations.",
      });
  });

  it("converts additional measurements while preserving units in text", () => {
    const data = form();
    data.append("additionalName", "glucose");
    data.append("additionalValue", "5.4 mmol/L");
    data.append("additionalName", "score");
    data.append("additionalValue", "0");
    data.append("additionalName", "");
    data.append("additionalValue", "");
    const result = parseIntakeForm(data);
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.vitals.additional).toEqual({ glucose: "5.4 mmol/L", score: 0 });
  });

  it("rejects duplicate or incomplete extra measurements before submission", () => {
    const data = form();
    data.append("additionalName", "glucose");
    data.append("additionalValue", "");
    expect(() => parseIntakeForm(data)).toThrow("name and a value");
    data.set("additionalValue", "5.4");
    data.append("additionalName", "glucose");
    data.append("additionalValue", "6");
    expect(() => parseIntakeForm(data)).toThrow("unique");
  });

  it("uses the shared validation and produces field labels for errors", () => {
    const data = form();
    data.set("heartRate", "-1");
    const result = parseIntakeForm(data);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(intakeValidationMessages(result.error)[0]).toMatch(/^Heart rate:/);
  });

  it("does not turn blank vitals into zero measurements", () => {
    const data = form();
    data.set("heartRate", "");
    expect(parseIntakeForm(data).success).toBe(false);
  });

  it("rejects reserved measurement names", () => {
    const data = form();
    data.append("additionalName", "__proto__");
    data.append("additionalValue", "5");
    expect(parseIntakeForm(data).success).toBe(false);
  });
});
