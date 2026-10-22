import type { NextRequest } from "next/server";

export function isPatientRoute(pathname: string): boolean {
  return pathname.startsWith("/patient");
}

export function hasActiveSession(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get("better-auth.session_token")?.value ||
    request.cookies.get("__Secure-better-auth.session_token")?.value
  );
}
