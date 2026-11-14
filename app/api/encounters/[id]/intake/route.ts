import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import {
  intakeEncounterParamsSchema,
  recordIntakeSchema,
  type RecordIntakeResponse,
} from "@/lib/schemas/intake";
import { recordIntake } from "@/lib/services/intake";
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
        { error: "Cross-origin intake changes are not allowed." },
        { status: 403, headers }
      );
    }
    const session = await requireRole("nurse", request.headers);
    const identifier = intakeEncounterParamsSchema.safeParse(await params);
    if (!identifier.success) {
      return NextResponse.json(
        { error: "Provide a valid encounter ID." },
        { status: 400, headers }
      );
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers }
      );
    }
    const parsed = recordIntakeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Provide valid intake records.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400, headers }
      );
    }
    const intake = await recordIntake({
      encounterId: identifier.data.id,
      intake: parsed.data,
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ intake } satisfies RecordIntakeResponse, {
      status: 201,
      headers,
    });
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
    // Database errors can contain clinical values; do not log the error or body.
    console.error("Nurse intake save failed.");
    return NextResponse.json(
      { error: "Unable to save intake records. Please try again." },
      { status: 500, headers }
    );
  }
}
