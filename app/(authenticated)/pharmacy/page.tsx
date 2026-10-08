import type { Metadata } from "next";
import { PharmacyDashboard } from "@/components/workspace/pharmacy-content";

export const metadata: Metadata = { title: "Inventory Dashboard" };
export const instant = false;

export default function PharmacyDashboardPage() {
  return <PharmacyDashboard />;
}
