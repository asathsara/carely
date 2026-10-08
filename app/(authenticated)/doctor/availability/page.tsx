import type { Metadata } from "next";
import { DoctorAvailability } from "@/components/workspace/doctor-content";

export const metadata: Metadata = { title: "Doctor Availability" };
export const instant = false;

export default function DoctorAvailabilityPage() {
  return <DoctorAvailability />;
}
