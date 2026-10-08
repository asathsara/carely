import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DemoForm } from "@/components/workspace/demo-form";
import { PageTitle, Panel, StatCards } from "@/components/workspace/workspace-ui";
import { demoPeople } from "@/lib/mock/content";
import { receptionScreens } from "@/lib/mock/screens";
import { cn } from "@/lib/utils";

const doctors = [
  {
    ...demoPeople.primaryDoctor,
    next: "10:30",
    slots: "2 slots",
  },
  {
    initials: "AF",
    name: "Dr. A. Fernando",
    specialty: "General Medicine",
    next: "10:45",
    slots: "4 slots",
  },
  {
    initials: "KS",
    name: "Dr. Kumari Silva",
    specialty: "Respiratory",
    next: "11:00",
    slots: "1 slot",
  },
  {
    initials: "RJ",
    name: "Dr. R. Jayasinghe",
    specialty: "General Medicine",
    next: "11:30",
    slots: "3 slots",
  },
];

const queues = [
  {
    ...demoPeople.primaryDoctor,
    token: "C-15",
    waiting: "8 waiting",
    wait: "25 min",
  },
  {
    initials: "AF",
    name: "Dr. A. Fernando",
    specialty: "General Medicine",
    token: "G-09",
    waiting: "6 waiting",
    wait: "18 min",
  },
  {
    initials: "KS",
    name: "Dr. Kumari Silva",
    specialty: "Respiratory",
    token: "R-07",
    waiting: "5 waiting",
    wait: "16 min",
  },
  {
    initials: "RJ",
    name: "Dr. R. Jayasinghe",
    specialty: "General Medicine",
    token: "G-14",
    waiting: "9 waiting",
    wait: "44 min",
    delayed: true,
  },
  {
    initials: "SP",
    name: "Dr. S. Perera",
    specialty: "Pediatrics",
    token: "P-06",
    waiting: "4 waiting",
    wait: "13 min",
  },
];

function Initials({ children }: { children: string }) {
  return (
    <span className="bg-secondary text-primary grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold">
      {children}
    </span>
  );
}

function ReceptionRegistration() {
  return (
    <>
      <PageTitle
        eyebrow="Front desk"
        title="Walk-in Registration"
        description="Register a walk-in patient or find an existing record."
      />
      <div className="bg-card mb-5 rounded-xl border p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Input
              id="patientSearch"
              label="Find patient"
              placeholder="Search by phone number or patient ID"
              controlSize="compact"
            />
          </div>
          <Button className="sm:min-w-32">Find patient</Button>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Existing patient">
          <div className="bg-carely-info rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="bg-primary text-primary-foreground grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold">
                {demoPeople.patient.initials}
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{demoPeople.patient.name}</p>
                <p className="text-muted-foreground text-xs">
                  {demoPeople.patient.id} • {demoPeople.patient.age}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Phone number</p>
                <p className="mt-1 font-semibold">{demoPeople.patient.phone}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last visit</p>
                <p className="mt-1 font-semibold">12 Sep • Cardiology</p>
              </div>
            </div>
          </div>
          <Button className="mt-4" fullWidth>
            Use existing patient
          </Button>
          <h3 className="mt-6 mb-3 text-sm font-semibold">Today at front desk</h3>
          <div className="space-y-3">
            {[
              ["09:40", "Walk-in registration", "Completed"],
              ["10:02", "OPD channeling", "Cardiology"],
            ].map(([time, activity, status]) => (
              <div
                key={time}
                className="bg-carely-surface grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-3 text-xs"
              >
                <span className="text-primary font-semibold">{time}</span>
                <span className="font-medium">{activity}</span>
                <span className="text-muted-foreground">{status}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="New patient">
          <DemoForm
            submitLabel="Register walk-in"
            columns={1}
            compact
            buttonAlign="end"
            fields={[
              { name: "name", placeholder: "Full name" },
              { name: "dob", placeholder: "Date of birth", type: "date" },
              { name: "phone", placeholder: "Phone number", type: "tel" },
              { name: "address", placeholder: "Address" },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

function ReceptionChanneling() {
  return (
    <>
      <PageTitle
        eyebrow="Front desk"
        title="On-site Channeling"
        description="Assign a walk-in patient to an available doctor slot."
      />
      <div className="bg-card mb-5 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground text-xs">Selected patient</p>
          <p className="mt-1 font-semibold">
            {demoPeople.patient.name} • {demoPeople.patient.id}
          </p>
        </div>
        <Button variant="outline">Change patient</Button>
      </div>
      <Panel title="Available today">
        <div className="space-y-3">
          {doctors.map((doctor) => (
            <div
              key={doctor.name}
              className="bg-carely-surface flex flex-col gap-4 rounded-xl p-3 sm:grid sm:grid-cols-[auto_minmax(0,1fr)_8rem_8rem] sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 items-center gap-3 sm:contents">
                <Initials>{doctor.initials}</Initials>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{doctor.name}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {doctor.specialty}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs sm:block">
                <div>
                  <p className="text-muted-foreground">Next</p>
                  <p className="mt-1 font-semibold">{doctor.next}</p>
                </div>
                <p className="text-muted-foreground self-end font-medium sm:mt-1">
                  {doctor.slots}
                </p>
              </div>
              <Button size="sm" fullWidth>
                Assign slot
              </Button>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground mt-6 text-xs">
          Channeling assigns an available slot and then places the patient into the
          correct department queue.
        </p>
      </Panel>
    </>
  );
}

function ReceptionQueue() {
  return (
    <>
      <PageTitle
        eyebrow="Front desk"
        title="Hospital Queue Management"
        description="Live view of every doctor queue and wait time across the hospital."
      />
      <StatCards metrics={receptionScreens.queue.metrics} />
      <Panel title="Live queues by doctor">
        <div className="space-y-3">
          {queues.map((queue) => (
            <div
              key={queue.name}
              className={cn(
                "rounded-xl p-3 sm:grid sm:grid-cols-[auto_minmax(10rem,1.5fr)_minmax(5rem,.65fr)_minmax(5rem,.65fr)_minmax(4rem,.55fr)_7rem] sm:items-center sm:gap-4",
                queue.delayed ? "bg-[#fff6df]" : "bg-carely-surface"
              )}
            >
              <div className="flex min-w-0 items-center gap-3 sm:contents">
                <Initials>{queue.initials}</Initials>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{queue.name}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {queue.specialty}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs sm:mt-0 sm:contents">
                <div>
                  <p className="text-muted-foreground">Now</p>
                  <p className="mt-1 font-semibold">{queue.token}</p>
                </div>
                <div>
                  <p className="text-muted-foreground sm:sr-only">Queue</p>
                  <p className="mt-1 font-medium sm:mt-0">{queue.waiting}</p>
                </div>
                <div>
                  <p className="text-muted-foreground sm:sr-only">Wait</p>
                  <p
                    className={cn(
                      "mt-1 font-semibold sm:mt-0",
                      queue.delayed && "text-[#c47b00]"
                    )}
                  >
                    {queue.wait}
                  </p>
                </div>
              </div>
              <Button className="mt-4 sm:mt-0" variant="outline" size="sm" fullWidth>
                Open queue
              </Button>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

export { ReceptionChanneling, ReceptionQueue, ReceptionRegistration };
