import { demoPeople } from "@/lib/mock/content";

export const defaultPatientProfile = {
  fullName: demoPeople.portalPatient.name,
  dateOfBirth: "2001-05-18",
  email: demoPeople.portalPatient.email,
  phone: "+94 77 123 4567",
  gender: "Female",
  address: demoPeople.portalPatient.address,
  emergencyContact: "Nimal Silva (Father) / +94 71 987 6543",
};
export type PatientProfileData = typeof defaultPatientProfile;

export const patientMedicines = [
  {
    code: "AM",
    name: "Amoxicillin",
    form: "500 mg capsule",
    dose: "1 capsule · three times daily",
    note: "Take after meals · 5 days",
  },
  {
    code: "PA",
    name: "Paracetamol",
    form: "500 mg tablet",
    dose: "2 tablets · when required",
    note: "Maximum 3 times per day",
  },
  {
    code: "OM",
    name: "Omeprazole",
    form: "20 mg capsule",
    dose: "1 capsule · once daily",
    note: "Take before breakfast · 7 days",
  },
] as const;
