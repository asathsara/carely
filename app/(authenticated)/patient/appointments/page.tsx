import Link from "next/link";
import type { Metadata } from "next";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  InitialAvatar,
  SegmentedTabs,
  StatusBadge,
  StepGuide,
} from "@/components/patient/patient-shared";
import { PageTitle } from "@/components/workspace/workspace-ui";
import { appContent, demoPeople } from "@/lib/mock/content";
import { cn } from "@/lib/utils";

function AppointmentCard({
  day,
  doctor,
  specialty,
  room,
  time,
  refn,
}: {
  day: string;
  doctor: string;
  specialty: string;
  room: string;
  time: string;
  refn: string;
}) {
  return (
    <div className="flex min-h-35 flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center">
      <div className="bg-secondary text-primary flex size-15 shrink-0 flex-col items-center justify-center rounded-xl p-1">
        <span className="text-xl leading-tight font-bold">{day}</span>
        <span className="text-primary/80 text-[10px] font-bold tracking-wider uppercase">
          OCT
        </span>
      </div>

      <div className="flex-1">
        <StatusBadge tone="green">Confirmed</StatusBadge>
        <p className="mt-2 text-sm font-semibold sm:text-base">{doctor}</p>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          {specialty} · {room}
        </p>
        <p className="mt-1.5 text-xs font-semibold sm:text-sm">
          {time} · Ref {refn}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            View details
          </Button>
          <Button variant="outline" size="sm">
            Cancel
          </Button>
        </div>
      </div>
      <span className="text-muted-foreground hidden text-xl font-light sm:block">›</span>
    </div>
  );
}

export const metadata: Metadata = {
  title: "Appointments",
  description: "View and manage your upcoming and past medical appointments.",
};

export default function PatientAppointmentsPage() {
  return (
    <>
      <PageTitle
        eyebrow="My care"
        title="Appointments"
        description="Review upcoming bookings and manage appointments before the scheduled time."
      />

      <SegmentedTabs active="Upcoming (2)" inactive="Past" />

      <div className="grid gap-5 lg:grid-cols-[2.4fr_1fr]">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold">Upcoming appointments</h2>
          <div className="space-y-3">
            <AppointmentCard
              day="12"
              doctor={demoPeople.primaryDoctor.name}
              specialty="Cardiology"
              room="OPD Room 04"
              time="09:30 AM"
              refn="APT-1012"
            />
            <AppointmentCard
              day="26"
              doctor="Dr. Samadhi Peris"
              specialty="General Medicine"
              room="OPD Room 02"
              time="11:00 AM"
              refn="APT-1026"
            />
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900">
            <InitialAvatar>!</InitialAvatar>
            <p>
              Appointments can be cancelled before check-in. Contact reception if you need
              assistance.
            </p>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold">Before your visit</h2>
          <div className="mt-5 space-y-6">
            <StepGuide
              number="01"
              title="Arrive early"
              copy="Please arrive 15 minutes before your scheduled appointment."
            />
            <StepGuide
              number="02"
              title="Bring identification"
              copy="Keep your hospital patient number available at check-in."
            />
            <StepGuide
              number="03"
              title="Check in at reception"
              copy="Your live queue token will be issued immediately upon check-in."
            />
          </div>

          <Link
            className={cn(buttonVariants({ size: "sm" }), "mt-6")}
            href="/patient/book"
          >
            Find another doctor
          </Link>

          <div className="mt-4 rounded-xl border p-4">
            <p className="text-xs font-semibold">Need to change a booking?</p>
            <p className="text-primary mt-1.5 text-lg font-bold">
              {appContent.hospital.phone}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Mon-Sat · 7:00 AM-8:00 PM
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
