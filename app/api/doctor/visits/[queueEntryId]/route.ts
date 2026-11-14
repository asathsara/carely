import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import {
  doctorVisitParamsSchema,
  type DoctorVisitResponse,
} from "@/lib/schemas/record-review";
import { getDoctorVisit } from "@/lib/services/record-review";
import { ServiceError } from "@/lib/services/service-error";
const headers = { "Cache-Control": "no-store" };
export async function GET(
  request: Request,
  { params }: { params: Promise<{ queueEntryId: string }> }
) {
  try {
    const session = await requireRole("doctor", request.headers);
    const identifier = doctorVisitParamsSchema.safeParse(await params);
    if (!identifier.success)
      return NextResponse.json(
        { error: "Provide a valid queue entry ID." },
        { status: 400, headers }
      );
    const visit = await getDoctorVisit({
      queueEntryId: identifier.data.queueEntryId,
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ visit } satisfies DoctorVisitResponse, { headers });
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
    console.error("Doctor visit read failed.");
    return NextResponse.json(
      { error: "Unable to load the visit. Please try again." },
      { status: 500, headers }
    );
  }
}
