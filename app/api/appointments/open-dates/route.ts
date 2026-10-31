import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { openDatesQuerySchema } from "@/lib/schemas/booking";
import { BookingServiceError, getOpenDatesForDoctor } from "@/lib/services/booking";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    const session = await requireRole(
      ["patient", "receptionist", "admin"],
      request.headers
    );
    if (session.user.banned) {
      throw new AuthError("Your account is unavailable.", 403);
    }

    const doctorIds = new URL(request.url).searchParams.getAll("doctorId");
    const input = openDatesQuerySchema.safeParse({ doctorId: doctorIds[0] });
    if (doctorIds.length !== 1 || !input.success) {
      return NextResponse.json(
        { error: "Provide a single valid doctorId.", code: "INVALID_INPUT" },
        { status: 400, headers }
      );
    }

    const result = await getOpenDatesForDoctor(input.data.doctorId);
    return NextResponse.json(result, { headers });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthError || error instanceof BookingServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error instanceof BookingServiceError ? { code: error.code } : {}),
        },
        { status: error.statusCode, headers }
      );
    }

    console.error("Open appointment dates request failed:", error);
    return NextResponse.json(
      { error: "Unable to load available dates. Please try again." },
      { status: 500, headers }
    );
  }
}
