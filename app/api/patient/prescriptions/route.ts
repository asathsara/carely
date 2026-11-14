import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { getPatientPrescriptions } from "@/lib/services/prescription";
import { ServiceError } from "@/lib/services/service-error";
import type { PatientPrescriptionsResponse } from "@/lib/schemas/prescription";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  try {
    const session = await requireRole("patient", request.headers);
    const prescriptions = await getPatientPrescriptions({
      userId: session.user.id,
      role: session.user.role,
    });
    return NextResponse.json({ prescriptions } satisfies PatientPrescriptionsResponse, {
      headers,
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthError || error instanceof ServiceError)
      return NextResponse.json(
        {
          error: error.message,
          ...(error instanceof ServiceError ? { code: error.code } : {}),
        },
        { status: error.statusCode, headers }
      );
    console.error("Patient prescription read failed.");
    return NextResponse.json(
      { error: "Unable to load prescriptions. Please try again." },
      { status: 500, headers }
    );
  }
}
