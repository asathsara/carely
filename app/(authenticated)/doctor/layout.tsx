import type { ReactNode } from "react";
import { AppShell } from "@/components/workspace/app-shell";
import { demoPeople } from "@/lib/mock/content";

export default function DoctorLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      role="doctor"
      user={{
        name: demoPeople.primaryDoctor.name,
        detail: demoPeople.primaryDoctor.specialty,
        initials: demoPeople.primaryDoctor.initials,
      }}
    >
      {children}
    </AppShell>
  );
}
