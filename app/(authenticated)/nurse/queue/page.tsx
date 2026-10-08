import type { Metadata } from "next";
import { NurseQueue } from "@/components/workspace/nurse-content";

export const metadata: Metadata = { title: "Queue Management" };
export const instant = false;

export default function NurseQueuePage() {
  return <NurseQueue />;
}
