import type { Metadata } from "next";
import { PageTitle } from "@/components/workspace/workspace-ui";
import { PrescriptionReader } from "@/components/pharmacy/prescription-reader";

export const metadata: Metadata = { title: "Prescriptions" };
export const instant = false;

export default function PrescriptionWorkbenchPage() {
  return (
    <>
      <PageTitle
        eyebrow="Pharmacy workspace"
        title="Prescriptions"
        description="Review issued prescriptions. Dispensing is not part of this sprint."
      />
      <PrescriptionReader />
    </>
  );
}
