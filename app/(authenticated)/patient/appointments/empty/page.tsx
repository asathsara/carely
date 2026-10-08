import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedTabs } from "@/components/patient/patient-shared";
import { PageTitle } from "@/components/workspace/workspace-ui";
import { appContent } from "@/lib/mock/content";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "No Appointments",
};

export default function EmptyAppointmentsPage() {
  return (
    <>
      <PageTitle
        eyebrow="My care"
        title="Appointments"
        description={`Bookings made through ${appContent.brand.name} will appear here.`}
      />

      <SegmentedTabs active="Upcoming (0)" inactive="Past" fullWidth />

      <Card className="flex min-h-140 flex-col items-center justify-center gap-4 p-8 text-center sm:p-12">
        <Image
          src="/images/empty-appointments.svg"
          alt={`${appContent.brand.name} calendar assistant`}
          width={126}
          height={151}
          priority
        />
        <h2 className="text-2xl font-bold">No appointments yet</h2>
        <p className="text-muted-foreground max-w-lg text-sm leading-relaxed">
          You don&apos;t have any scheduled appointments. Find a doctor and choose an
          available time.
        </p>
        <Link
          className={cn(buttonVariants({}), "w-full sm:w-auto sm:min-w-48")}
          href="/patient/book"
        >
          Book an appointment
        </Link>

        <div className="bg-carely-surface flex min-h-20 w-full max-w-xl items-center gap-3 rounded-xl px-4 py-3 text-left">
          <span className="bg-card text-primary grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold">
            ?
          </span>
          <div>
            <p className="text-sm font-semibold">Need help booking?</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Contact reception on {appContent.hospital.phone}.
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}
