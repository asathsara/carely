import type { ReactNode } from "react";
import { AppShell } from "@/components/workspace/app-shell";

export default function PharmacyLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      role="pharmacy"
      user={{ name: "A. Silva", detail: "Pharmacist", initials: "PH" }}
    >
      {children}
    </AppShell>
  );
}
