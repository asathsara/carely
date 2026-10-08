import type { ReactNode } from "react";
import { AppShell } from "@/components/workspace/app-shell";

export default function NurseLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      role="nurse"
      user={{ name: "N. Fernando", detail: "OPD Nurse", initials: "NR" }}
    >
      {children}
    </AppShell>
  );
}
