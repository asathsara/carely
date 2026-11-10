import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { patientProfileUpdateSchema } from "@/lib/schemas/patient-update";
import { updateOwnPatientProfile } from "@/lib/services/patient";
import { ServiceError } from "@/lib/services/service-error";

const headers = { "Cache-Control": "no-store" };
export async function PATCH(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return NextResponse.json(
        { error: "Cross-origin profile changes are not allowed." },
        { status: 403, headers }
      );
    const session = await requireRole("patient", request.headers);
    const body: unknown = await request.json().catch(() => null);
    const parsed = patientProfileUpdateSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Provide permitted profile fields only." },
        { status: 400, headers }
      );
    const patient = await updateOwnPatientProfile(parsed.data, {
      userId: session.user.id,
      role: session.user.role,
    });
    return NextResponse.json({ patient }, { headers });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthError || error instanceof ServiceError)
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode, headers }
      );
    console.error("Patient profile update failed:", error);
    return NextResponse.json(
      { error: "Unable to update profile." },
      { status: 500, headers }
    );
  }
}
