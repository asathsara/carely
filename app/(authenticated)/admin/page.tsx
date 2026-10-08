import type { Metadata } from "next";
import { AdminDashboard } from "@/components/workspace/admin-content";

export const metadata: Metadata = { title: "Administration Dashboard" };
export const instant = false;

export default function AdminDashboardPage() {
  return <AdminDashboard />;
}
