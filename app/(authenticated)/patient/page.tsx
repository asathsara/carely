import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FactCard,
  StatusBadge,
  patientMedicines,
} from "@/components/patient/patient-shared";
import { DataList, PageTitle, Panel } from "@/components/workspace/workspace-ui";
import { appContent, demoPeople } from "@/lib/mock/content";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Patient Dashboard",
  description: "View your appointments, queue status, and prescriptions.",
};

export default function PatientPage() {
  return (
    <>
      <PageTitle
        eyebrow="Overview"
        title="Good morning, Kavindi"
        description="Manage your appointments, queue status, and prescriptions from one place."
        action={
          <Image
            src="/images/dashboard-health.svg"
            alt={`${appContent.brand.name} health assistant`}
            width={74}
            height={94}
            priority
          />
        }
      />

      <div className="mb-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">
              Next appointment
            </p>
            <StatusBadge tone="green">Confirmed</StatusBadge>
          </div>
          <h2 className="mt-3 text-xl font-bold">{demoPeople.primaryDoctor.name}</h2>
          <p className="text-muted-foreground mt-1.5 text-xs sm:text-sm">
            Cardiology · OPD Room 04
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <FactCard label="Date" value="12 Oct 2026" />
            <FactCard label="Time" value="09:30 AM" />
            <FactCard label="Reference" value="APT-1048" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link className={buttonVariants({ size: "sm" })} href="/patient/appointments">
              View appointment
            </Link>
            <Link
              className={buttonVariants({ variant: "outline", size: "sm" })}
              href="/patient/book"
            >
              Find another doctor
            </Link>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">
            Live queue
          </p>
          <h2 className="mt-3 text-xl font-bold">No active queue</h2>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed sm:text-sm">
            Your token will appear here after reception checks you in.
          </p>
          <div className="mt-4">
            <StatusBadge tone="blue">Updates every 30 seconds</StatusBadge>
          </div>
          <Link
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
            href="/patient/queue"
          >
            Open live queue
          </Link>
        </Card>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Upcoming appointments", val: "2", status: "Next: 12 Oct" },
          { label: "Active prescriptions", val: "1", status: "View details" },
          { label: "Profile status", val: "Complete", status: "Email verified" },
        ].map((item, index) => (
          <Card key={item.label} className="min-h-28 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                {item.label}
              </p>
              <StatusBadge tone={index ? "green" : "blue"}>{item.status}</StatusBadge>
            </div>
            <p className="mt-2 text-2xl font-bold">{item.val}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.08fr]">
        <Panel title="Quick actions" className="p-5 sm:p-6">
          <DataList
            variant="action"
            items={[
              {
                title: "Find a doctor",
                subtitle: "Choose by specialty and availability",
                meta: "FD",
                status: "Start",
                href: "/patient/book",
              },
              {
                title: "My appointments",
                subtitle: "Review confirmed bookings",
                meta: "AP",
                status: "Open",
                href: "/patient/appointments",
              },
              {
                title: "Live queue",
                subtitle: "Check your current position",
                meta: "LQ",
                status: "Open",
                href: "/patient/queue",
              },
            ]}
          />
        </Panel>

        <Panel
          title="Latest prescription"
          action={<StatusBadge tone="green">Active</StatusBadge>}
          className="p-5 sm:p-6"
        >
          <p className="text-muted-foreground mb-4 text-sm">
            Issued by {demoPeople.primaryDoctor.name} · 04 Oct 2026
          </p>
          <DataList
            variant="action"
            items={patientMedicines.slice(0, 2).map((med) => ({
              title: `${med.name} ${med.form.replace(" capsule", "").replace(" tablet", "")}`,
              subtitle: med.dose,
              meta: "RX",
            }))}
          />
          <Link
            className={cn(
              buttonVariants({ variant: "outline", size: "sm", fullWidth: true }),
              "mt-5"
            )}
            href="/patient/prescriptions"
          >
            View full prescription
          </Link>
        </Panel>
      </div>
    </>
  );
}
