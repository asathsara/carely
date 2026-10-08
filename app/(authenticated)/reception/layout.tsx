import type { ReactNode } from "react";
import { AppShell } from "@/components/workspace/app-shell";

export default function ReceptionLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      role="reception"
      user={{ name: "M. Perera", detail: "Reception", initials: "RC" }}
    >
      {children}
    </AppShell>
  );
}
