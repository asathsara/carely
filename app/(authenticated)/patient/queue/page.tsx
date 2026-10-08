import Image from "next/image";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  InitialAvatar,
  StatusBadge,
  StepGuide,
} from "@/components/patient/patient-shared";
import { PageTitle } from "@/components/workspace/workspace-ui";
import { appContent, demoPeople } from "@/lib/mock/content";

export const metadata: Metadata = {
  title: "Live Queue",
  description: "Track your real-time queue position and token status.",
};

export default function PatientQueuePage() {
  return (
    <>
      <PageTitle
        eyebrow="Live status"
        title="Live queue"
        description="Your position refreshes automatically every 30 seconds while the page is open."
        action={
          <Image
            src="/images/live-queue.svg"
            alt={`${appContent.brand.name} live queue assistant`}
            width={74}
            height={100}
            priority
          />
        }
      />

      <div className="grid gap-5 lg:grid-cols-[2.1fr_1fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              OPD Queue · {demoPeople.primaryDoctor.name}
            </h2>
            <StatusBadge tone="green">Queue active</StatusBadge>
          </div>

          <div className="bg-primary mt-5 grid gap-5 rounded-xl p-5 text-white shadow-xs sm:grid-cols-2 sm:p-6">
            <div>
              <p className="text-xs font-semibold tracking-wider text-white/80 uppercase">
                Your token
              </p>
              <p className="mt-1.5 text-4xl font-bold tracking-tight">A-18</p>
              <p className="mt-3 text-xs text-white/90">Checked in at 09:12 AM</p>
            </div>
            <div className="bg-carely-primary-deep rounded-xl p-4 text-center sm:p-5">
              <p className="text-xs font-semibold tracking-wider text-white/80 uppercase">
                Current position
              </p>
              <p className="mt-1 text-3xl font-bold">3rd</p>
              <p className="mt-2 text-xs text-white/90">Approx. 18 minutes</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold sm:text-sm">Queue progress</p>
              <span className="text-muted-foreground text-xs">15 of 20 completed</span>
            </div>
            <div className="bg-border mt-3.5 h-2.5 overflow-hidden rounded-full">
              <div className="bg-primary h-full w-3/4 rounded-full" />
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 py-1">
                <InitialAvatar>A16</InitialAvatar>
                <div className="flex-1">
                  <p className="text-xs font-semibold sm:text-sm">Now serving</p>
                  <p className="text-muted-foreground text-xs">
                    Patient is currently with the doctor
                  </p>
                </div>
                <StatusBadge tone="blue">In progress</StatusBadge>
              </div>

              <div className="flex items-center gap-3 py-1">
                <InitialAvatar>A17</InitialAvatar>
                <div className="flex-1">
                  <p className="text-xs font-semibold sm:text-sm">Ahead of you</p>
                  <p className="text-muted-foreground text-xs">
                    Please remain nearby in the waiting lobby
                  </p>
                </div>
                <StatusBadge tone="amber">Next</StatusBadge>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border p-4 sm:p-5">
            <p className="text-xs font-semibold sm:text-sm">Appointment details</p>
            <div className="mt-3 flex items-center gap-3">
              <InitialAvatar>DR</InitialAvatar>
              <div>
                <p className="text-xs font-semibold sm:text-sm">
                  {demoPeople.primaryDoctor.name}
                </p>
                <p className="text-muted-foreground text-xs">Cardiology · OPD Room 04</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <InitialAvatar>TM</InitialAvatar>
              <div>
                <p className="text-xs font-semibold sm:text-sm">Today · 09:30 AM</p>
                <p className="text-muted-foreground text-xs">Reference APT-1048</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold">What to do now</h2>
          <div className="mt-5 space-y-6">
            <StepGuide
              number="1"
              title="Stay nearby"
              copy="Your position may move faster than estimated."
            />
            <StepGuide
              number="2"
              title="Watch the token"
              copy="Queue status refreshes automatically every 30 seconds."
            />
            <StepGuide
              number="3"
              title="Go when called"
              copy="Proceed directly to OPD Room 04 when A-18 is called."
            />
          </div>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-900">If you miss your turn</p>
            <p className="mt-1.5 text-xs leading-relaxed text-amber-800">
              Speak with reception. Your position cannot be modified from the portal.
            </p>
          </div>

          <Button className="mt-4" variant="outline" size="sm">
            Refresh now
          </Button>
          <p className="text-muted-foreground mt-3 text-xs">Last updated 10:02:30 AM</p>
        </Card>
      </div>
    </>
  );
}
