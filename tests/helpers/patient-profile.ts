import type { PatientProfile } from "@/lib/schemas/patient-update";
export const savedPatientProfile: PatientProfile = {
  id: "11111111-1111-4111-8111-111111111111",
  patientNo: "PAT-009999",
  fullName: "Saved Patient",
  dateOfBirth: "1990-04-12",
  gender: "Other",
  email: "saved-patient@test.invalid",
  emailVerified: true,
  phone: "0771111111",
  address: "Saved address",
  emergencyContactName: "Saved contact",
  emergencyContactPhone: "0772222222",
};
