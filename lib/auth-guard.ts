import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
export type AuthUser = AuthSession["user"];

/**
 * Ensures the incoming request has an authenticated session.
 * Throws an AuthError (401) if unauthenticated.
 */
export async function requireAuth(): Promise<AuthSession> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new AuthError("Unauthorized: Session required", 401);
  }

  return session;
}

/**
 * Ensures the incoming request has an authenticated session with one of the allowed roles.
 * Throws an AuthError (401 if unauthenticated, 403 if insufficient privileges).
 */
export async function requireRole(...allowedRoles: string[]): Promise<AuthSession> {
  const session = await requireAuth();
  const userRole = session.user.role;

  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new AuthError("Forbidden: Insufficient privileges", 403);
  }

  return session;
}
