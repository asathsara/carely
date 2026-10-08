import type { Metadata } from "next";
import { ReceptionQueue } from "@/components/workspace/reception-content";

export const metadata: Metadata = { title: "Hospital Queue Management" };
export const instant = false;

export default function ReceptionQueuePage() {
  return <ReceptionQueue />;
}
