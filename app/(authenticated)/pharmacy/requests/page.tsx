import type { Metadata } from "next";
import { PharmacyRequests } from "@/components/workspace/pharmacy-content";

export const metadata: Metadata = { title: "Stock Requests" };
export const instant = false;

export default function PharmacyRequestsPage() {
  return <PharmacyRequests />;
}
