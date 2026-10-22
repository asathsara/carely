import { headers } from "next/headers";
import type { ReactNode } from "react";
import { PatientDemoProvider } from "@/components/patient/patient-demo-provider";
import { AppShell } from "@/components/workspace/app-shell";
import { auth } from "@/lib/auth";
import { demoPeople } from "@/lib/mock/content";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default async function PatientLayout({ children }: { children: ReactNode }) {
  let displayName: string = demoPeople.portalPatient.name;
  let initials: string = demoPeople.portalPatient.initials;

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (session?.user?.name) {
      displayName = session.user.name;
      initials = getInitials(session.user.name);
    }
  } catch {
    // Fall back to demo user
  }

  return (
    <PatientDemoProvider>
      <AppShell
        role="patient"
        user={{
          name: displayName,
          detail: "Patient",
          initials,
        }}
      >
        {children}
      </AppShell>
    </PatientDemoProvider>
  );
}
