import type { Metadata } from "next";
import { ReceptionChanneling } from "@/components/workspace/reception-content";

export const metadata: Metadata = { title: "On-site Channeling" };
export const instant = false;

export default function ReceptionChannelingPage() {
  return <ReceptionChanneling />;
}
