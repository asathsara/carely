import Image from "next/image";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import {
  FactCard,
  InitialAvatar,
  SegmentedTabs,
  StatusBadge,
  patientMedicines,
} from "@/components/patient/patient-shared";
import { PrintPrescriptionButton } from "@/components/workspace/print-prescription-button";
import { PageTitle } from "@/components/workspace/workspace-ui";
import { appContent, demoPeople } from "@/lib/mock/content";

function MedicineItem({ item }: { item: (typeof patientMedicines)[number] }) {
  return (
    <div className="flex min-h-28 flex-col justify-between gap-4 rounded-xl border p-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3.5">
        <span className="bg-secondary text-primary grid size-11 shrink-0 place-items-center rounded-xl text-xs font-bold">
          {item.code}
        </span>
        <div className="space-y-0.5">
          <p className="text-foreground text-sm font-semibold sm:text-base">
            {item.name}
          </p>
          <p className="text-muted-foreground text-xs">{item.form}</p>
          <p className="text-primary text-xs font-semibold sm:text-sm">{item.dose}</p>
          <p className="text-muted-foreground text-xs">{item.note}</p>
        </div>
      </div>
      <StatusBadge tone="blue">Prescribed</StatusBadge>
    </div>
  );
}

export const metadata: Metadata = {
  title: "Prescriptions",
  description: "View active doctor prescriptions and medication dosages.",
};

export default function PatientPrescriptionsPage() {
  return (
    <>
      <PageTitle
        eyebrow="My medication"
        title="Prescriptions"
        description="View medication details issued by your doctor. This portal does not send medication reminders."
        action={
          <Image
            src="/images/prescription.svg"
            alt={`${appContent.brand.name} prescription assistant`}
            width={70}
            height={96}
            priority
          />
        }
      />

      <SegmentedTabs active="Active (1)" inactive="Completed" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,790fr)_333fr]">
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold sm:text-lg">
                Prescription RX-2026-184
              </h2>
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                Issued 04 Oct 2026 · {demoPeople.primaryDoctor.name}
              </p>
            </div>
            <StatusBadge tone="green">Active</StatusBadge>
          </div>

          <div className="space-y-3">
            {patientMedicines.map((med) => (
              <MedicineItem key={med.code} item={med} />
            ))}
          </div>

          <div className="mt-2 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            <InitialAvatar>!</InitialAvatar>
            <p>
              Follow the doctor&apos;s instructions carefully. Contact the hospital if the
              prescription is unclear or you experience an adverse reaction.
            </p>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <h2 className="text-base font-semibold">Prescription summary</h2>

          <div className="min-h-24 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Medicines
              </p>
              <StatusBadge tone="green">Active</StatusBadge>
            </div>
            <p className="mt-1 text-2xl font-bold">3</p>
          </div>

          <div className="min-h-24 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Prescribed on
              </p>
              <StatusBadge tone="blue">Dr. Perera</StatusBadge>
            </div>
            <p className="mt-1 text-2xl font-bold">04 Oct</p>
          </div>

          <FactCard
            label="Prescribed by"
            value={`${demoPeople.primaryDoctor.name} · Cardiology · ${appContent.hospital.name}`}
          />

          <PrintPrescriptionButton />

          <p className="text-muted-foreground text-xs leading-relaxed">
            Medication refills can be requested directly at the hospital pharmacy counter.
          </p>
        </Card>
      </div>
    </>
  );
}
