import type { Metadata } from "next";
import { AdminAudit } from "@/components/workspace/admin-content";

export const metadata: Metadata = { title: "Audit Trail" };
export const instant = false;

export default function AdminAuditPage() {
  return <AdminAudit />;
}
