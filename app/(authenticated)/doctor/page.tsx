import type { Metadata } from "next";
import { DoctorDashboard } from "@/components/workspace/doctor-content";

export const metadata: Metadata = { title: "Doctor Dashboard" };
export const instant = false;

export default function DoctorDashboardPage() {
  return <DoctorDashboard />;
}
