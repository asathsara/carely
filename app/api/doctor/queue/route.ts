import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { getDoctorConsultationQueue } from "@/lib/services/consultation";
import { ServiceError } from "@/lib/services/service-error";

const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  try {
    const session = await requireRole("doctor", request.headers);
    const entries = await getDoctorConsultationQueue({
      userId: session.user.id,
      role: session.user.role,
    });
    return NextResponse.json({ entries }, { headers });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthError || error instanceof ServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode, headers }
      );
    }
    console.error("Doctor queue request failed.");
    return NextResponse.json(
      { error: "Unable to load your queue." },
      { status: 500, headers }
    );
  }
}
