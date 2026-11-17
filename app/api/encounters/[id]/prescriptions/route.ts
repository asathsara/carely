import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import {
  createPrescriptionSchema,
  prescriptionEncounterParamsSchema,
  type CreatePrescriptionResponse,
} from "@/lib/schemas/prescription";
import { createPrescription } from "@/lib/services/prescription";
import { ServiceError } from "@/lib/services/service-error";

const headers = { "Cache-Control": "no-store" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "Cross-origin prescription changes are not allowed." },
        { status: 403, headers }
      );
    }
    const session = await requireRole("doctor", request.headers);
    const identifier = prescriptionEncounterParamsSchema.safeParse(await params);
    if (!identifier.success)
      return NextResponse.json(
        { error: "Provide a valid encounter ID." },
        { status: 400, headers }
      );
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers }
      );
    }
    const parsed = createPrescriptionSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "Provide a valid prescription.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400, headers }
      );
    const prescription = await createPrescription({
      encounterId: identifier.data.id,
      prescription: parsed.data,
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ prescription } satisfies CreatePrescriptionResponse, {
      status: 201,
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
    console.error("Prescription save failed.");
    return NextResponse.json(
      { error: "Unable to save the prescription. Please try again." },
      { status: 500, headers }
    );
  }
}
