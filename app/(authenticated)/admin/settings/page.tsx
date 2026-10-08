import type { Metadata } from "next";
import { AdminSettings } from "@/components/workspace/admin-content";

export const metadata: Metadata = { title: "System Settings" };
export const instant = false;

export default function AdminSettingsPage() {
  return <AdminSettings />;
}
