import type { ReactNode } from "react";
import { AppShell } from "@/components/workspace/app-shell";
import { demoPeople } from "@/lib/mock/content";

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      role="patient"
      user={{
        name: demoPeople.portalPatient.name,
        detail: "Patient",
        initials: demoPeople.portalPatient.initials,
      }}
    >
      {children}
    </AppShell>
  );
}
