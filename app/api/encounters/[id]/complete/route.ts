import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import {
  completeConsultationParamsSchema,
  completeConsultationSchema,
  type CompleteConsultationResponse,
} from "@/lib/schemas/consultation";
import { completeConsultation } from "@/lib/services/consultation";
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
        { error: "Cross-origin consultation changes are not allowed." },
        { status: 403, headers }
      );
    }
    const session = await requireRole("doctor", request.headers);
    const identifier = completeConsultationParamsSchema.safeParse(await params);
    if (!identifier.success) {
      return NextResponse.json(
        { error: "Provide a valid encounter ID." },
        { status: 400, headers }
      );
    }
    let body: unknown;
    try {
      const text = await request.text();
      body = text.trim() ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers }
      );
    }
    if (!completeConsultationSchema.safeParse(body).success) {
      return NextResponse.json(
        { error: "Completing a consultation does not accept body fields." },
        { status: 400, headers }
      );
    }
    const consultation = await completeConsultation({
      encounterId: identifier.data.id,
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ consultation } satisfies CompleteConsultationResponse, {
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
    console.error("Consultation completion failed.");
    return NextResponse.json(
      { error: "Unable to complete the consultation. Please try again." },
      { status: 500, headers }
    );
  }
}
