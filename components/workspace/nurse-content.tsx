import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DemoForm } from "@/components/workspace/demo-form";
import {
  DataList,
  PageTitle,
  Panel,
  StatCards,
  WorkTable,
} from "@/components/workspace/workspace-ui";
import { demoPeople } from "@/lib/mock/content";
import { nurseScreens } from "@/lib/mock/screens";

function NurseQueue() {
  return (
    <>
      <PageTitle
        eyebrow="Care workspace"
        title="Queue Management"
        description="Manage position, priority, wait time and actions for the assigned queue."
      />
      <StatCards metrics={nurseScreens.queue.metrics} />
      <div className="grid gap-6 lg:grid-cols-[3fr_1.18fr]">
        <Panel title="Cardiology OPD queue">
          <WorkTable
            variant="surface"
            highlightFirst
            showHeader={false}
            headers={["Token", "Patient", "Wait", "Priority", "Action"]}
            rows={[
              ["C-12", "Kumari Silva", "31 min", "Urgent", "Start intake"],
              ["C-13", "Ananda Fernando", "27 min", "Normal", "Start intake"],
              ["C-14", "Nimal Jayawardena", "23 min", "Normal", "Start intake"],
              ["C-15", demoPeople.patient.name, "18 min", "Normal", "Start intake"],
              ["C-16", "Shalini De Silva", "12 min", "Normal", "Start intake"],
              ["C-17", "Ruwan Bandara", "7 min", "Normal", "Start intake"],
            ]}
          />
        </Panel>
        <Panel title="Selected patient">
          <p className="text-lg font-bold">Kumari Silva</p>
          <p className="text-muted-foreground mb-8 text-sm">C-12 · 64 years</p>
          <div className="space-y-3">
            <Button fullWidth>Begin intake</Button>
            <Button fullWidth variant="outline">
              Mark temporarily away
            </Button>
            <Button fullWidth variant="outline">
              Move with reason
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}

function NurseNotes() {
  return (
    <>
      <PageTitle
        eyebrow="Care workspace"
        title="Preliminary Notes"
        description="Record patient observations and the initial complaint."
      />
      <div className="grid gap-6 lg:grid-cols-[2.1fr_1fr]">
        <Panel title="Vitals & observations">
          <DemoForm
            submitLabel="Save preliminary note"
            compact
            fields={[
              { name: "respiratoryRate", placeholder: "Respiratory rate" },
              { name: "spo2", placeholder: "SpO₂" },
              { name: "bloodPressure", placeholder: "Systolic BP" },
              { name: "pulse", placeholder: "Pulse" },
              { name: "temperature", placeholder: "Temperature" },
              { name: "complaint", placeholder: "Initial complaint" },
            ]}
          />
        </Panel>
        <Panel title="Patient context">
          <DataList items={nurseScreens.notes.items} />
        </Panel>
      </div>
    </>
  );
}

function NurseIntake() {
  return (
    <>
      <PageTitle
        eyebrow="Care workspace"
        title="Patient Intake"
        description="Find an existing patient or create a new clinical record."
      />
      <div className="bg-card mb-5 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            id="nursePatientSearch"
            label="Search patient"
            placeholder="Search by phone or patient ID"
            controlSize="compact"
          />
        </div>
        <Button className="sm:min-w-36">Search patient</Button>
      </div>
      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <Panel title="Existing patient" className="min-h-97">
          <div className="bg-secondary flex items-center gap-4 rounded-xl p-4">
            <span className="bg-card text-primary grid size-14 shrink-0 place-items-center rounded-full text-sm font-bold">
              SP
            </span>
            <div>
              <p className="text-sm font-semibold">{demoPeople.patient.name}</p>
              <p className="text-muted-foreground mt-1 text-[10px]">
                {demoPeople.patient.id} · {demoPeople.patient.age} ·{" "}
                {demoPeople.patient.phone}
              </p>
              <p className="text-muted-foreground mt-2 text-[10px]">
                Last visit 12 Sep · Cardiology
              </p>
            </div>
          </div>
          <Button className="mt-4" fullWidth>
            Continue with this patient
          </Button>
          <h3 className="mt-7 mb-2 text-xs font-semibold">Recent visits</h3>
          <WorkTable
            variant="surface"
            showHeader={false}
            headers={["Date", "Department", "Reason"]}
            rows={[
              ["12 Sep", "Cardiology", "Follow-up"],
              ["18 Aug", "General OPD", "Medication refill"],
              ["02 Jul", "Lab", "HbA1c"],
            ]}
          />
        </Panel>
        <Panel title="Register new patient" className="min-h-97">
          <DemoForm
            columns={1}
            compact
            buttonAlign="end"
            submitLabel="Create patient record"
            fields={[
              { name: "name", placeholder: "Full name" },
              { name: "dob", placeholder: "Date of birth" },
              { name: "phone", placeholder: "Phone number" },
              { name: "address", placeholder: "Address" },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

export { NurseIntake, NurseNotes, NurseQueue };
