import type { ReactNode } from "react";
import { AppShell } from "@/components/workspace/app-shell";
import { appContent } from "@/lib/mock/content";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      role="admin"
      user={{ name: "System Admin", detail: appContent.hospital.name, initials: "AD" }}
    >
      {children}
    </AppShell>
  );
}
