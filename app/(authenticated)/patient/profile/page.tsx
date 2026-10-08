import type { Metadata } from "next";
import { PatientProfile } from "@/components/patient/patient-profile";

export const metadata: Metadata = {
  title: "Profile & Settings",
  description: "Manage your contact information, hospital record, and account security.",
};

export default function PatientProfilePage() {
  return <PatientProfile />;
}
