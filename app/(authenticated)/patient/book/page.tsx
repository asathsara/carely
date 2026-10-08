import Link from "next/link";
import type { Metadata } from "next";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InitialAvatar, StatusBadge } from "@/components/patient/patient-shared";
import { PageTitle } from "@/components/workspace/workspace-ui";
import { appContent, demoPeople } from "@/lib/mock/content";
import { cn } from "@/lib/utils";

const doctorsList = [
  {
    initials: "NP",
    name: demoPeople.primaryDoctor.name,
    desc: "Cardiology · 12 years experience",
    avail: "Next: Mon, 12 Oct · 09:30 AM",
  },
  {
    initials: "SP",
    name: "Dr. Samadhi Peris",
    desc: "General Medicine · 8 years experience",
    avail: "Next: Mon, 12 Oct · 11:00 AM",
  },
  {
    initials: "RF",
    name: "Dr. Ruwan Fernando",
    desc: "Dermatology · 10 years experience",
    avail: "Next: Tue, 13 Oct · 08:45 AM",
  },
];

export const metadata: Metadata = {
  title: "Find a Doctor",
  description: "Search doctors by specialty and book available appointment slots.",
};

export default function PatientBookPage() {
  return (
    <>
      <PageTitle
        eyebrow="Appointments"
        title="Find a doctor"
        description="Search by specialty, then choose an available date and time."
      />

      <Card className="mb-5 grid gap-3 p-3.5 sm:grid-cols-2 lg:grid-cols-[1.6fr_.8fr_.8fr_.58fr]">
        <Input
          id="doctorSearch"
          label="Search doctor"
          placeholder="Search doctor or specialty..."
        />
        <button
          type="button"
          className="bg-card text-foreground hover:bg-secondary h-12 rounded-lg border px-4 text-left text-xs font-medium transition-colors sm:h-14 sm:text-sm"
        >
          All specialties
        </button>
        <button
          type="button"
          className="bg-card text-foreground hover:bg-secondary h-12 rounded-lg border px-4 text-left text-xs font-medium transition-colors sm:h-14 sm:text-sm"
        >
          Any available date
        </button>
        <Button className="h-12 text-sm font-semibold sm:h-14">Search</Button>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.85fr_1fr]">
        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold">Available doctors</h2>
            <p className="text-muted-foreground text-xs sm:text-sm">6 results</p>
          </div>

          <div className="space-y-3">
            {doctorsList.map((doc, index) => (
              <div
                key={doc.initials}
                className={cn(
                  "flex min-h-32 flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center",
                  !index && "border-primary bg-carely-surface"
                )}
              >
                <InitialAvatar large>{doc.initials}</InitialAvatar>
                <div className="flex-1">
                  <p className="text-sm font-semibold sm:text-base">{doc.name}</p>
                  <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                    {doc.desc}
                  </p>
                  <div className="mt-2.5">
                    <StatusBadge tone="green">{doc.avail}</StatusBadge>
                  </div>
                </div>
                <Button variant={index ? "outline" : "default"} size="sm">
                  {index ? "Select" : "Selected"}
                </Button>
              </div>
            ))}
          </div>

          <Button className="mt-4" variant="outline" size="sm">
            Load more doctors
          </Button>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold">Book appointment</h2>
          <p className="text-muted-foreground mt-1.5 text-xs sm:text-sm">
            {demoPeople.primaryDoctor.name} · {demoPeople.primaryDoctor.specialty}
          </p>

          <p className="text-primary mt-5 text-xs font-semibold tracking-wider uppercase">
            1. Choose date
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {["MON\n12", "TUE\n13", "WED\n14", "THU\n15"].map((dateText, index) => (
              <button
                key={dateText}
                type="button"
                className={cn(
                  "min-h-18 rounded-xl border text-xs font-semibold whitespace-pre-line transition-colors",
                  !index ? "bg-primary text-white" : "hover:bg-secondary"
                )}
              >
                {dateText}
              </button>
            ))}
          </div>

          <p className="text-primary mt-5 text-xs font-semibold tracking-wider uppercase">
            2. Choose time
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {["09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM"].map(
              (timeSlot, index) => (
                <button
                  key={timeSlot}
                  type="button"
                  className={cn(
                    "h-10 rounded-lg border text-xs font-semibold transition-colors",
                    !index ? "bg-primary text-white" : "hover:bg-secondary"
                  )}
                >
                  {timeSlot}
                </button>
              )
            )}
          </div>

          <div className="mt-5 min-h-28 rounded-xl border p-4">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Booking summary
            </p>
            <p className="mt-2 text-sm font-semibold">Monday, 12 October · 09:30 AM</p>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
              {appContent.hospital.name} · OPD Room 04
            </p>
          </div>

          <Link
            className={cn(buttonVariants({ fullWidth: true }), "mt-5")}
            href="/patient/appointments/confirmed"
          >
            Confirm appointment
          </Link>
        </Card>
      </div>
    </>
  );
}
