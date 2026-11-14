import type { ZodError } from "zod";
import { recordIntakeSchema } from "@/lib/schemas/intake";

export const intakeMeasurements = [
  { name: "bpSystolic", label: "Systolic blood pressure", unit: "mmHg", step: "1" },
  { name: "bpDiastolic", label: "Diastolic blood pressure", unit: "mmHg", step: "1" },
  { name: "heartRate", label: "Heart rate", unit: "beats/min", step: "1" },
  { name: "respiratoryRate", label: "Respiratory rate", unit: "breaths/min", step: "1" },
  { name: "temperatureC", label: "Temperature", unit: "°C", step: "0.1" },
  { name: "spo2", label: "SpO₂", unit: "%", step: "1" },
  { name: "weightKg", label: "Weight", unit: "kg", step: "0.1" },
  { name: "heightCm", label: "Height", unit: "cm", step: "0.1" },
] as const;

export function parseIntakeForm(data: FormData) {
  const vitals: Record<string, unknown> = {};
  for (const field of intakeMeasurements) {
    const value = String(data.get(field.name) ?? "").trim();
    if (value) vitals[field.name] = Number(value);
  }
  const names = data.getAll("additionalName");
  const values = data.getAll("additionalValue");
  const extra: Record<string, number | string> = Object.create(null);
  for (let i = 0; i < names.length; i++) {
    const name = String(names[i]).trim();
    const value = String(values[i] ?? "").trim();
    if (!name && !value) continue;
    if (!name || !value)
      throw new Error("Give each additional measurement a name and a value.");
    if (Object.hasOwn(extra, name))
      throw new Error("Additional measurement names must be unique.");
    extra[name] = Number.isFinite(Number(value)) ? Number(value) : value;
  }
  if (Object.keys(extra).length) vitals.additional = extra;
  return recordIntakeSchema.safeParse({
    vitals,
    complaint: data.get("complaint"),
    preliminaryNote: data.get("preliminaryNote"),
  });
}

export function intakeValidationMessages(error: ZodError) {
  return error.issues.map((issue) => {
    const key = issue.path[0] === "vitals" ? issue.path[1] : issue.path[0];
    const label =
      intakeMeasurements.find((field) => field.name === key)?.label ??
      (key === "complaint"
        ? "Initial complaint"
        : key === "preliminaryNote"
          ? "Nursing observations"
          : key === "additional"
            ? "Additional measurements"
            : "Measurements");
    return `${label}: ${issue.message}`;
  });
}
