import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/workspace/app-shell";
import { auth } from "@/lib/auth";
import { getDefaultRouteForRole } from "@/lib/config/navigation";
import { getOrCreatePatientForUser } from "@/lib/services/patient";

export const instant = false;

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "PT"
  );
}

export default async function PatientLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user || session.user.banned) {
    redirect("/login?callbackUrl=/patient");
  }

  if (session.user.role !== "patient")
    redirect(getDefaultRouteForRole(session.user.role));
  await getOrCreatePatientForUser(session.user.id);
  return (
    <AppShell
      role="patient"
      user={{
        name: session.user.name,
        detail: "Patient",
        initials: getInitials(session.user.name),
      }}
    >
      {children}
    </AppShell>
  );
}
