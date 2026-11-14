import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import {
  openConsultationParamsSchema,
  openConsultationSchema,
  type OpenConsultationResponse,
} from "@/lib/schemas/consultation";
import { openConsultation } from "@/lib/services/consultation";
import { ServiceError } from "@/lib/services/service-error";

const headers = { "Cache-Control": "no-store" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> }
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
    const identifier = openConsultationParamsSchema.safeParse(await params);
    if (!identifier.success) {
      return NextResponse.json(
        { error: "Provide a valid queue entry ID." },
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
    if (!openConsultationSchema.safeParse(body).success) {
      return NextResponse.json(
        { error: "Opening a consultation does not accept body fields." },
        { status: 400, headers }
      );
    }
    const consultation = await openConsultation({
      entryId: identifier.data.entryId,
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ consultation } satisfies OpenConsultationResponse, {
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
    console.error("Consultation opening failed.");
    return NextResponse.json(
      { error: "Unable to open the consultation. Please try again." },
      { status: 500, headers }
    );
  }
}
