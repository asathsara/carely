"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { SIDEBAR_ICON_SIZE } from "@/lib/constants/ui";
import { roleNavigation } from "@/lib/config/navigation";
import { cn } from "@/lib/utils";

function NavLinks({
  role,
  onNavigate,
}: {
  role: keyof typeof roleNavigation;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = roleNavigation[role];
  const patient = role === "patient";
  return (
    <nav className="flex flex-col gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        const isWorkspaceRoot = item.href === `/${role}`;
        const active =
          pathname === item.href ||
          (!isWorkspaceRoot && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 text-sm font-medium",
              patient ? "group rounded-lg transition-colors" : "rounded-md",
              active
                ? cn("bg-primary text-primary-foreground", patient && "shadow-sm")
                : "text-foreground hover:bg-secondary"
            )}
          >
            <span
              className={cn(
                "grid place-items-center rounded-md",
                patient ? "size-8 shrink-0 transition-colors" : "size-7",
                active
                  ? "bg-card text-primary"
                  : cn(
                      "bg-secondary text-muted-foreground",
                      patient && "group-hover:text-primary"
                    )
              )}
            >
              <Icon size={SIDEBAR_ICON_SIZE - 4} />
            </span>
            <span className={patient ? "min-w-0 truncate" : undefined}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNavigation({
  role,
  user,
}: {
  role: keyof typeof roleNavigation;
  user: { name: string; detail: string; initials: string };
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="bg-card grid size-10 place-items-center rounded-md border"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu size={20} />
      </button>
      {open ? (
        <div
          className="bg-foreground/30 fixed inset-0 z-50"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <aside
            className="bg-card ml-auto flex h-full w-72 max-w-[85vw] flex-col p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar alt={user.name} fallback={user.initials} />
                <div>
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-muted-foreground text-xs">{user.detail}</p>
                </div>
              </div>
              <button
                type="button"
                className="hover:bg-secondary grid size-10 place-items-center rounded-md"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <NavLinks role={role} onNavigate={() => setOpen(false)} />
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-auto flex items-center gap-3 px-3 py-3 text-sm font-medium"
            >
              <LogOut size={SIDEBAR_ICON_SIZE} />
              Log out
            </Link>
          </aside>
        </div>
      ) : null}
    </>
  );
}

export { MobileNavigation, NavLinks };
