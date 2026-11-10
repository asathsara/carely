import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { checkInAppointmentSchema } from "@/lib/schemas/queue";
import { checkInAppointment } from "@/lib/services/queue";
import { ServiceError } from "@/lib/services/service-error";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "Cross-origin queue changes are not allowed." },
        { status: 403, headers }
      );
    }
    const session = await requireRole("receptionist", request.headers);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers }
      );
    }
    const parsed = checkInAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Provide a valid appointment ID." },
        { status: 400, headers }
      );
    }
    const entry = await checkInAppointment({
      appointmentId: parsed.data.appointmentId,
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ entry }, { status: 201, headers });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthError || error instanceof ServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error instanceof ServiceError ? { code: error.code } : {}),
        },
        { status: error.statusCode, headers }
      );
    }
    console.error("Queue check-in failed:", error);
    return NextResponse.json(
      { error: "Unable to check in the appointment. Please try again." },
      { status: 500, headers }
    );
  }
}
