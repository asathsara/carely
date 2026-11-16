import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import {
  prescriptionParamsSchema,
  type PrescriptionResponse,
} from "@/lib/schemas/prescription";
import { getPrescription } from "@/lib/services/prescription";
import { ServiceError } from "@/lib/services/service-error";
const headers = { "Cache-Control": "no-store" };
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("pharmacist", request.headers);
    const identifier = prescriptionParamsSchema.safeParse(await params);
    if (!identifier.success)
      return NextResponse.json(
        { error: "Provide a valid prescription ID." },
        { status: 400, headers }
      );
    const prescription = await getPrescription({
      prescriptionId: identifier.data.id,
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ prescription } satisfies PrescriptionResponse, {
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
    console.error("Prescription read failed.");
    return NextResponse.json(
      { error: "Unable to load the prescription. Please try again." },
      { status: 500, headers }
    );
  }
}
