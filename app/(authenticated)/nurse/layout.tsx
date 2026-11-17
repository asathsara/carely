import type { ReactNode } from "react";
import { AppShell } from "@/components/workspace/app-shell";
import { requireAuth } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { getDefaultRouteForRole } from "@/lib/config/navigation";

export const instant = false;

export default async function NurseLayout({ children }: { children: ReactNode }) {
  const session = await requireAuth();
  if (session.user.role !== "nurse") redirect(getDefaultRouteForRole(session.user.role));
  const initials =
    session.user.name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "NR";
  return (
    <AppShell role="nurse" user={{ name: session.user.name, detail: "Nurse", initials }}>
      {children}
    </AppShell>
  );
}
