import {
  patientProfileUpdateSchema,
  type PatientProfile,
  type PatientProfileUpdate,
} from "@/lib/schemas/patient-update";

export const patientContactFields = [
  "phone",
  "address",
  "emergencyContactName",
  "emergencyContactPhone",
] as const;
export type PatientContactDraft = Record<(typeof patientContactFields)[number], string>;

export function patientContactDraft(profile: PatientProfile): PatientContactDraft {
  return {
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    emergencyContactName: profile.emergencyContactName ?? "",
    emergencyContactPhone: profile.emergencyContactPhone ?? "",
  };
}

export function buildPatientProfilePatch(
  profile: PatientProfile,
  draft: PatientContactDraft
): PatientProfileUpdate | null {
  const changes: PatientProfileUpdate = {};
  for (const field of patientContactFields) {
    const value = draft[field].trim() || null;
    if (value !== profile[field]) changes[field] = value;
  }
  return Object.keys(changes).length ? patientProfileUpdateSchema.parse(changes) : null;
}
