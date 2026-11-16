import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import {
  doctorPatientHistoryParamsSchema,
  type PatientHistoryResponse,
} from "@/lib/schemas/record-review";
import { getPatientHistory } from "@/lib/services/record-review";
import { ServiceError } from "@/lib/services/service-error";
const headers = { "Cache-Control": "no-store" };
export async function GET(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const session = await requireRole("doctor", request.headers);
    const identifier = doctorPatientHistoryParamsSchema.safeParse(await params);
    if (!identifier.success)
      return NextResponse.json(
        { error: "Provide a valid patient ID." },
        { status: 400, headers }
      );
    const history = await getPatientHistory({
      patientId: identifier.data.patientId,
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ history } satisfies PatientHistoryResponse, { headers });
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
    console.error("Patient history read failed.");
    return NextResponse.json(
      { error: "Unable to load patient history. Please try again." },
      { status: 500, headers }
    );
  }
}
