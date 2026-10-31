import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/workspace/app-shell";
import { auth } from "@/lib/auth";
import { getDefaultRouteForRole } from "@/lib/config/navigation";

export const instant = false;

export default async function DoctorLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user || session.user.banned) {
    redirect("/login?callbackUrl=/doctor");
  }

  if (session.user.role !== "doctor") {
    redirect(getDefaultRouteForRole(session.user.role));
  }

  const initials =
    session.user.name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "DR";

  return (
    <AppShell
      role="doctor"
      user={{
        name: session.user.name,
        detail: "Doctor",
        initials,
      }}
    >
      {children}
    </AppShell>
  );
}
