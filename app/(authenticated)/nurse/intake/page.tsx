import type { Metadata } from "next";
import { NurseIntake } from "@/components/workspace/nurse-content";

export const metadata: Metadata = { title: "Patient Intake" };
export const instant = false;

export default function NurseIntakePage() {
  return <NurseIntake />;
}
