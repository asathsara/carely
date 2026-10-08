import type { Metadata } from "next";
import { AdminStaff } from "@/components/workspace/admin-content";

export const metadata: Metadata = { title: "Staff Management" };
export const instant = false;

export default function AdminStaffPage() {
  return <AdminStaff />;
}
