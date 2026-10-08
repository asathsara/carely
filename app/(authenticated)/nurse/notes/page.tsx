import type { Metadata } from "next";
import { NurseNotes } from "@/components/workspace/nurse-content";

export const metadata: Metadata = { title: "Preliminary Notes" };
export const instant = false;

export default function NurseNotesPage() {
  return <NurseNotes />;
}
