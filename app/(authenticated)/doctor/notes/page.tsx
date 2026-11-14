import type { Metadata } from "next";
import { ClinicalRecordWorkspace } from "@/components/doctor/clinical-record-workspace";

export const metadata: Metadata = { title: "Clinical Notes" };
export const instant = false;

export default function DoctorNotesPage() {
  return <ClinicalRecordWorkspace />;
}
