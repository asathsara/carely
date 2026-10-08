import type { Metadata } from "next";
import { PharmacyStock } from "@/components/workspace/pharmacy-content";

export const metadata: Metadata = { title: "Edit Stock" };
export const instant = false;

export default function PharmacyStockPage() {
  return <PharmacyStock />;
}
