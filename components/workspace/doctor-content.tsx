import { ArrowRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DoctorClinicalNoteForm } from "@/components/workspace/doctor-clinical-note-form";
import {
  PageTitle,
  Panel,
  StatCards,
  WorkTable,
} from "@/components/workspace/workspace-ui";
import { demoPeople } from "@/lib/mock/content";
import { doctorScreens } from "@/lib/mock/screens";

const appointments = [
  ["09:00", demoPeople.patient.name, "Hypertension", "Waiting"],
  ["09:30", "Kumari Silva", "Bronchitis", "In progress"],
  ["10:00", "Ananda Fernando", "Headache", "Waiting"],
  ["10:30", "Nimal Jayawardena", "Respiratory", "Done"],
  ["11:00", "Shalini De Silva", "Medication review", "Waiting"],
  ["11:30", "Chamari W.", "Follow-up", "Waiting"],
  ["12:00", "Ruwan Bandara", "Diabetes review", "Waiting"],
];

const medications = [
  { name: "Metformin 500 mg", schedule: "Twice daily" },
  { name: "Amlodipine 5 mg", schedule: "Once daily" },
  { name: "Atorvastatin 20 mg", schedule: "Night" },
];

function DoctorPatients() {
  return (
    <>
      <PageTitle
        eyebrow="Clinical workspace"
        title="Patient Profile"
        description="Longitudinal record for pre-consultation review."
      />
      <Card className="mb-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar
            alt={demoPeople.patient.name}
            fallback={demoPeople.patient.initials}
            size={48}
          />
          <div className="min-w-0">
            <p className="text-lg font-bold">{demoPeople.patient.name}</p>
            <p className="text-muted-foreground text-sm">
              {demoPeople.patient.id} • {demoPeople.patient.age} • Male •{" "}
              {demoPeople.primaryDoctor.specialty}
            </p>
          </div>
        </div>
        <Badge className="bg-carely-success-soft text-carely-success self-start px-4 py-2 sm:self-auto">
          Active patient
        </Badge>
      </Card>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Clinical snapshot">
          <div className="space-y-5 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Chronic conditions</p>
              <p className="mt-1 font-semibold">Hypertension • Type 2 diabetes</p>
            </div>
            <p className="text-destructive font-semibold">Allergy: Penicillin</p>
            <p>
              Last vitals&nbsp;&nbsp; BP 138/86 &nbsp;•&nbsp; HR 82 &nbsp;•&nbsp; SpO₂ 97%
            </p>
          </div>
        </Panel>
        <Panel title="Current medications">
          <div className="space-y-3">
            {medications.map((medicine) => (
              <div
                key={medicine.name}
                className="bg-carely-surface grid gap-1 rounded-md p-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6"
              >
                <p className="font-semibold">{medicine.name}</p>
                <p className="text-muted-foreground">{medicine.schedule}</p>
                <p className="text-carely-success text-xs font-semibold">Active</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Patient timeline">
        <WorkTable
          showHeader={false}
          headers={["Date", "Department", "Reason", "Action"]}
          rows={[
            ["12 Sep", "Cardiology OPD", "BP review", "View note"],
            ["18 Aug", "General OPD", "Medication refill", "View note"],
            ["02 Jul", "Lab visit", "HbA1c result", "View result"],
            ["21 May", "Cardiology OPD", "Initial review", "View note"],
          ]}
        />
      </Panel>
    </>
  );
}

function DoctorNotes() {
  return (
    <>
      <PageTitle
        eyebrow="Clinical workspace"
        title="Clinical Notes"
        description="Structured consultation note, vitals and prescription builder."
      />
      <DoctorClinicalNoteForm
        defaultValues={{
          complaint: "Dizziness for 3 days",
          observations:
            "Patient reports intermittent dizziness when standing. No chest pain or syncope.",
          assessment: "Likely postural hypotension; review antihypertensive regimen.",
          plan: "Hydration advice, BP log, follow-up in 2 weeks.",
        }}
        medications={[
          { name: "Amlodipine 5 mg", dose: "1 tablet • once daily" },
          { name: "Metformin 500 mg", dose: "1 tablet • twice daily" },
        ]}
      />
    </>
  );
}

function DoctorDashboard() {
  return (
    <>
      <PageTitle
        eyebrow="Clinical workspace"
        title="Assigned Patients"
        description="Appointments and patient workload at a glance."
      />
      <StatCards metrics={doctorScreens.dashboard.metrics} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <Panel title="Today’s appointments">
          <WorkTable
            showHeader={false}
            headers={["Time", "Patient", "Reason", "Status"]}
            rows={appointments}
          />
        </Panel>
        <Panel title="Quick actions">
          <div className="space-y-3">
            <Button variant="secondary" fullWidth className="justify-start">
              <ArrowRight />
              Open patient queue
            </Button>
            <Button variant="secondary" fullWidth className="justify-start">
              <ArrowRight />
              View full schedule
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}

export { DoctorDashboard, DoctorNotes, DoctorPatients };
