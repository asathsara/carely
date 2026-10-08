import Link from "next/link";
import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FactCard, StatusBadge } from "@/components/patient/patient-shared";
import { PrintPrescriptionButton } from "@/components/workspace/print-prescription-button";
import { PageTitle } from "@/components/workspace/workspace-ui";
import { appContent, demoPeople } from "@/lib/mock/content";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Appointment Confirmed",
};

export default function AppointmentConfirmedPage() {
  return (
    <>
      <PageTitle
        eyebrow="Booking complete"
        title="Appointment confirmed"
        description="Your booking has been saved. Keep the reference number for reception."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="min-h-160 p-6 sm:p-8 lg:col-span-2">
          <span className="bg-carely-success-soft text-carely-success grid size-18 place-items-center rounded-full text-sm font-bold">
            {"\u2713"}
          </span>
          <h2 className="mt-4 text-2xl font-bold">You&apos;re booked!</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            A confirmation email has been sent to {demoPeople.portalPatient.email}.
          </p>

          <div className="bg-carely-surface mt-5 flex min-h-28 items-center gap-4 rounded-2xl border p-5">
            <span className="bg-secondary text-primary grid size-14 shrink-0 place-items-center rounded-full text-sm font-bold">
              {demoPeople.primaryDoctor.initials}
            </span>
            <div>
              <p className="font-semibold">{demoPeople.primaryDoctor.name}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {demoPeople.primaryDoctor.specialty} &middot; {appContent.hospital.name}
              </p>
              <div className="mt-2">
                <StatusBadge tone="green">Confirmed</StatusBadge>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <FactCard surface label="Date" value="Monday, 12 October 2026" />
            <FactCard surface label="Time" value="09:30 AM" />
            <FactCard surface label="Reference" value="APT-1048" />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              className={cn(buttonVariants({}), "sm:min-w-44")}
              href="/patient/appointments"
            >
              View appointments
            </Link>
            <Link
              className={cn(buttonVariants({ variant: "outline" }), "sm:min-w-44")}
              href="/patient"
            >
              Back to dashboard
            </Link>
            <PrintPrescriptionButton
              className="sm:w-28"
              label="Print"
              variant="outline"
            />
          </div>
        </Card>

        <Card className="min-h-160 p-5">
          <h2 className="font-semibold">Before your visit</h2>
          <div className="mt-4 space-y-4">
            <FactCard
              surface
              label="Arrive early"
              value="Please arrive 15 minutes before your appointment."
            />
            <FactCard
              surface
              label="Bring identification"
              value="Keep your hospital patient number available."
            />
            <FactCard
              surface
              label="Check in"
              value="Reception will issue your live queue token."
            />
          </div>
          <div className="mt-4 min-h-28 rounded-xl bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-600">
              Didn&apos;t receive the email?
            </p>
            <p className="mt-2 text-xs leading-relaxed">
              Check spam or open Appointments—the booking is already saved.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
