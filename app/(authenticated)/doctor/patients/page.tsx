import type { Metadata } from "next";
import { DoctorPatients } from "@/components/workspace/doctor-content";

export const metadata: Metadata = { title: "Patients" };
export const instant = false;

export default function DoctorPatientsPage() {
  return <DoctorPatients />;
}
