import { screenDataSchema } from "@/lib/schemas/screens";
import { demoPeople } from "@/lib/mock/content";

const screen = (data: unknown) => screenDataSchema.parse(data);

export const doctorScreens = {
  dashboard: screen({
    metrics: [
      { label: "Patients today", value: "18", tone: "blue" },
      { label: "Appointments", value: "12", tone: "sky" },
      { label: "Completed", value: "6", tone: "green" },
    ],
    items: [
      {
        title: demoPeople.patient.name,
        subtitle: "09:00 • Hypertension",
        status: "Waiting",
      },
      {
        title: "Kumari Silva",
        subtitle: "09:30 • Bronchitis",
        status: "In progress",
      },
      {
        title: "Ananda Fernando",
        subtitle: "10:00 • Headache",
        status: "Waiting",
      },
      {
        title: "Nimal Jayawardena",
        subtitle: "10:30 • Respiratory",
        status: "Done",
      },
    ],
  }),
  patients: screen({
    items: [
      {
        title: demoPeople.patient.name,
        subtitle: `${demoPeople.patient.id} • ${demoPeople.patient.age} • ${demoPeople.primaryDoctor.specialty}`,
        status: "Active patient",
      },
      {
        title: "Chronic conditions",
        subtitle: "Hypertension • Type 2 diabetes",
        meta: "Allergy: Penicillin",
      },
      { title: "Metformin 500 mg", subtitle: "Twice daily", status: "Active" },
      { title: "Amlodipine 5 mg", subtitle: "Once daily", status: "Active" },
    ],
  }),
  notes: screen({
    items: [
      {
        title: "Current patient",
        subtitle: `${demoPeople.patient.name} • ${demoPeople.patient.id}`,
      },
      { title: "Vitals", subtitle: "BP 118/72 • HR 76 • SpO₂ 98% • 36.8°C" },
    ],
  }),
  availability: screen({
    items: ["Mon 21", "Tue 22", "Wed 23", "Thu 24", "Fri 25"].map((title, i) => ({
      title,
      subtitle: i === 2 ? "No sessions" : "09:00–12:00 • 4 slots",
      status: i === 2 ? "Blocked" : "Available",
    })),
  }),
};

export const nurseScreens = {
  intake: screen({
    items: [
      {
        title: demoPeople.patient.name,
        subtitle: `${demoPeople.patient.id} • ${demoPeople.patient.age} • ${demoPeople.patient.phone}`,
        status: "Existing patient",
      },
      { title: "12 Sep", subtitle: "Cardiology • Follow-up" },
      { title: "18 Aug", subtitle: "General OPD • Medication refill" },
    ],
  }),
  queue: screen({
    metrics: [
      { label: "Waiting", value: "12", tone: "blue" },
      { label: "Average wait", value: "24 min", tone: "sky" },
      { label: "In assessment", value: "3", tone: "green" },
      { label: "Priority", value: "2", tone: "amber" },
    ],
    items: [
      { title: "C-12 • Kumari Silva", meta: "31 min", status: "Urgent" },
      { title: "C-13 • Ananda Fernando", meta: "27 min", status: "Normal" },
      { title: "C-14 • Nimal Jayawardena", meta: "23 min", status: "Normal" },
      { title: `C-15 • ${demoPeople.patient.name}`, meta: "18 min", status: "Normal" },
    ],
  }),
  notes: screen({
    items: [
      { title: "Ananda Fernando", subtitle: "P-00155 • Queue C-13" },
      { title: "Known condition", subtitle: "Migraine" },
      { title: "Allergies", subtitle: "None recorded" },
    ],
  }),
};

export const pharmacyScreens = {
  dashboard: screen({
    metrics: [
      { label: "Stock items", value: "486", tone: "blue" },
      { label: "Low stock", value: "12", tone: "amber" },
      { label: "Out of stock", value: "4", tone: "red" },
      { label: "Expiring soon", value: "8", tone: "sky" },
    ],
    items: [
      {
        title: "Amoxicillin 500 mg",
        subtitle: "Qty 240 • Reorder 80",
        status: "In stock",
      },
      {
        title: "Metformin 500 mg",
        subtitle: "Qty 72 • Reorder 100",
        status: "Low stock",
      },
      {
        title: "Salbutamol inhaler",
        subtitle: "Qty 0 • Reorder 20",
        status: "Out of stock",
      },
      {
        title: "Paracetamol 500 mg",
        subtitle: "Qty 620 • Reorder 200",
        status: "In stock",
      },
    ],
  }),
  stock: screen({
    items: [
      {
        title: "Metformin 500 mg",
        subtitle: "Tablet • MED-0042",
        status: "Low stock",
      },
      { title: "Stock health", subtitle: "28 units below threshold" },
      { title: "Last updated", subtitle: "Today, 09:48 by A. Silva" },
    ],
  }),
  requests: screen({
    metrics: [
      { label: "Open requests", value: "9", tone: "blue" },
      { label: "Ready", value: "5", tone: "green" },
      { label: "Unavailable", value: "2", tone: "red" },
      { label: "Awaiting review", value: "2", tone: "amber" },
    ],
    items: [
      {
        title: `REQ-1082 • ${demoPeople.patient.name}`,
        subtitle: "Amlodipine 5 mg",
        status: "Ready",
      },
      {
        title: "REQ-1083 • Kumari Silva",
        subtitle: "Salbutamol inhaler",
        status: "Unavailable",
      },
      {
        title: "REQ-1084 • Nimal J.",
        subtitle: "Metformin 500 mg",
        status: "Review",
      },
    ],
  }),
};

export const adminScreens = {
  dashboard: screen({
    metrics: [
      { label: "Active staff", value: "84", tone: "blue" },
      { label: "Doctors on duty", value: "12", tone: "blue" },
      { label: "Open queues", value: "6", tone: "sky" },
    ],
    items: [
      { title: "Registered patient P-0182", subtitle: "10:18 • Receptionist" },
      { title: "Signed clinical note for P-0142", subtitle: "10:12 • Doctor" },
      { title: "Updated Metformin stock", subtitle: "10:06 • Pharmacist" },
    ],
  }),
  staff: screen({
    items: [
      {
        title: demoPeople.primaryDoctor.name,
        subtitle: `Doctor • ${demoPeople.primaryDoctor.specialty}`,
        status: "Active",
      },
      { title: "N. Fernando", subtitle: "Nurse • OPD", status: "Active" },
      {
        title: "A. Silva",
        subtitle: "Pharmacist • Pharmacy",
        status: "Active",
      },
      {
        title: "M. Perera",
        subtitle: "Receptionist • Front desk",
        status: "Active",
      },
      {
        title: "Dr. A. Fernando",
        subtitle: "Doctor • General Medicine",
        status: "Inactive",
      },
    ],
  }),
  settings: screen({
    items: [
      {
        title: "Doctor",
        subtitle: "Clinical records, prescriptions, availability",
      },
      { title: "Nurse", subtitle: "Intake, queue, preliminary notes" },
      { title: "Receptionist", subtitle: "Registration, channeling, queue" },
      { title: "Pharmacist", subtitle: "Inventory and stock requests" },
    ],
  }),
  audit: screen({
    items: [
      {
        title: "PATIENT_CREATE",
        subtitle: "M. Perera • P-0182",
        meta: "10:18:42",
      },
      {
        title: "CLINICAL_NOTE_SIGN",
        subtitle: `${demoPeople.primaryDoctor.name} • P-0142`,
        meta: "10:12:08",
      },
      {
        title: "STOCK_UPDATE",
        subtitle: "A. Silva • MED-0042",
        meta: "10:06:31",
      },
      {
        title: "ALERT_ESCALATE",
        subtitle: "N. Fernando • P-0161",
        meta: "09:54:12",
      },
    ],
  }),
};

export const receptionScreens = {
  register: screen({
    items: [
      {
        title: demoPeople.patient.name,
        subtitle: `${demoPeople.patient.id} • ${demoPeople.patient.age} • ${demoPeople.patient.phone}`,
        status: "Existing patient",
      },
      { title: "09:40", subtitle: "Walk-in registration", status: "Completed" },
      { title: "10:02", subtitle: "OPD channeling", status: "Cardiology" },
    ],
  }),
  channeling: screen({
    items: [
      {
        title: demoPeople.primaryDoctor.name,
        subtitle: `${demoPeople.primaryDoctor.specialty} • Next 10:30`,
        status: "2 slots",
      },
      {
        title: "Dr. A. Fernando",
        subtitle: "General Medicine • Next 10:45",
        status: "4 slots",
      },
      {
        title: "Dr. Kumari Silva",
        subtitle: "Respiratory • Next 11:00",
        status: "1 slot",
      },
    ],
  }),
  queue: screen({
    metrics: [
      { label: "Waiting patients", value: "38", tone: "blue" },
      { label: "Open doctor queues", value: "9", tone: "blue" },
      { label: "Average wait", value: "21 min", tone: "sky" },
      { label: "Longest wait", value: "44 min", tone: "amber" },
    ],
    items: [
      {
        title: demoPeople.primaryDoctor.name,
        subtitle: `${demoPeople.primaryDoctor.specialty} • Now C-15`,
        meta: "25 min",
        status: "8 waiting",
      },
      {
        title: "Dr. A. Fernando",
        subtitle: "General Medicine • Now G-09",
        meta: "18 min",
        status: "6 waiting",
      },
      {
        title: "Dr. Kumari Silva",
        subtitle: "Respiratory • Now R-07",
        meta: "16 min",
        status: "5 waiting",
      },
    ],
  }),
};

export const patientScreens = {
  dashboard: screen({
    metrics: [
      { label: "Upcoming appointments", value: "2", note: "Next: 12 Oct" },
      { label: "Active prescriptions", value: "1" },
      { label: "Profile status", value: "Complete" },
    ],
    items: [
      {
        title: demoPeople.primaryDoctor.name,
        subtitle: `${demoPeople.primaryDoctor.specialty} • 12 Oct 2026 • 09:30 AM`,
        status: "Confirmed",
      },
      {
        title: "Amoxicillin 500 mg",
        subtitle: "1 capsule • three times daily • 5 days",
        status: "Active",
      },
    ],
  }),
  book: screen({
    items: [
      {
        title: demoPeople.primaryDoctor.name,
        subtitle: `${demoPeople.primaryDoctor.specialty} • Next Mon, 12 Oct • 09:30 AM`,
        status: "Selected",
      },
      {
        title: "Dr. Samadhi Peris",
        subtitle: "General Medicine • Next Mon, 12 Oct • 11:00 AM",
        status: "Available",
      },
      {
        title: "Dr. Ruwan Fernando",
        subtitle: "Dermatology • Next Tue, 13 Oct • 08:45 AM",
        status: "Available",
      },
    ],
  }),
  appointments: screen({
    items: [
      {
        title: demoPeople.primaryDoctor.name,
        subtitle: `${demoPeople.primaryDoctor.specialty} • 12 Oct • 09:30 AM`,
        status: "Confirmed",
      },
      {
        title: "Dr. Samadhi Peris",
        subtitle: "General Medicine • 26 Oct • 11:00 AM",
        status: "Confirmed",
      },
    ],
  }),
  queue: screen({
    metrics: [
      { label: "Your token", value: "A-18" },
      { label: "Current position", value: "3rd" },
      { label: "Approximate wait", value: "18 min" },
    ],
    items: [
      {
        title: "A16",
        subtitle: "Patient is with the doctor",
        status: "Now serving",
      },
      { title: "A17", subtitle: "Please remain nearby", status: "Next" },
    ],
  }),
  prescriptions: screen({
    items: [
      {
        title: "Amoxicillin",
        subtitle: "500 mg • 1 capsule three times daily",
        status: "Active",
      },
      {
        title: "Paracetamol",
        subtitle: "500 mg • 2 tablets when required",
        status: "Prescribed",
      },
      {
        title: "Omeprazole",
        subtitle: "20 mg • once daily",
        status: "Prescribed",
      },
    ],
  }),
  profile: screen({
    items: [
      { title: "Full name", subtitle: "Kavindi Silva" },
      { title: "Date of birth", subtitle: "18 May 2001" },
      {
        title: "Email",
        subtitle: "kavindi.silva@example.com",
        status: "Verified",
      },
      { title: "Phone", subtitle: "+94 77 123 4567" },
      { title: "Address", subtitle: demoPeople.portalPatient.address },
    ],
  }),
};
