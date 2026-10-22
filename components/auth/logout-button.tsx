"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { SIDEBAR_ICON_SIZE } from "@/lib/constants/ui";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } finally {
      router.push("/login");
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-foreground hover:text-destructive transition-colors text-left"
    >
      <LogOut size={SIDEBAR_ICON_SIZE} />
      Log out
    </button>
  );
}
