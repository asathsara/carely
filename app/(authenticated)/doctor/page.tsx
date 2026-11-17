import type { Metadata } from "next";
import { ConsultationQueue } from "@/components/doctor/consultation-queue";
import { PageTitle } from "@/components/workspace/workspace-ui";

export const metadata: Metadata = { title: "Doctor Dashboard" };
export const instant = false;

export default function DoctorDashboardPage() {
  return (
    <>
      <PageTitle
        eyebrow="Clinical workspace"
        title="Assigned Patients"
        description="Open visits after nurse intake and complete consultations after recording a clinical note."
      />
      <ConsultationQueue />
    </>
  );
}
