import type { Metadata } from "next";
import { DoctorNotes } from "@/components/workspace/doctor-content";

export const metadata: Metadata = { title: "Clinical Notes" };
export const instant = false;

export default function DoctorNotesPage() {
  return <DoctorNotes />;
}
