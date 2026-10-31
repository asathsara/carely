import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { BookingServiceError } from "@/lib/services/booking";

export const appointmentHeaders = { "Cache-Control": "no-store" };

export async function requireAppointmentSession(
  request: Request,
  roles = ["patient", "receptionist", "admin"]
) {
  const origin = request.headers.get("Origin");
  if (request.method !== "GET" && origin && origin !== new URL(request.url).origin) {
    throw new AuthError("Cross-origin appointment changes are not allowed.", 403);
  }
  const session = await requireRole(roles, request.headers);
  if (session.user.banned) throw new AuthError("Your account is unavailable.", 403);
  return session;
}

export function appointmentError(error: unknown) {
  unstable_rethrow(error);
  if (error instanceof AuthError || error instanceof BookingServiceError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode, headers: appointmentHeaders }
    );
  }
  console.error("Appointment request failed:", error);
  return NextResponse.json(
    { error: "Unable to access appointments. Please try again." },
    { status: 500, headers: appointmentHeaders }
  );
}
