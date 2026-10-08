export const appContent = {
  brand: {
    name: "Carely",
    initials: "C",
    descriptor: "Hospital Management",
    patientPortal: "Patient Portal",
  },
  hospital: {
    name: "ABC Hospital",
    initials: "WH",
    serviceLabel: "Patient services",
    phone: "+94 31 222 4567",
  },
  portal: {
    title: "ABC Hospital patient portal",
    description:
      "Appointments, queue updates, prescriptions, and your hospital account in one secure place.",
    instanceNote: "Your account is connected only to this hospital's Carely instance.",
    supportNote: "Contact hospital reception for booking or queue support.",
  },
} as const;

export const demoPeople = {
  patient: {
    name: "Saman Perera",
    initials: "SP",
    id: "P-00142",
    age: "58 years",
    phone: "077 123 4567",
  },
  portalPatient: {
    name: "Kavindi Silva",
    initials: "KA",
    address: "24 Lake Road, Negombo",
    email: "kavindi.silva@example.com",
  },
  primaryDoctor: {
    name: "Dr. Nimal Perera",
    initials: "NP",
    specialty: "Cardiology",
  },
} as const;
