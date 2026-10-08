import type { Metadata } from "next";
import { ReceptionRegistration } from "@/components/workspace/reception-content";

export const metadata: Metadata = { title: "Walk-in Registration" };
export const instant = false;

export default function ReceptionRegisterPage() {
  return <ReceptionRegistration />;
}
