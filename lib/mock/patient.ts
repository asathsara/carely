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
