import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import type { NurseQueueResponse } from "@/lib/schemas/intake";
import { getNurseQueue } from "@/lib/services/intake";
import { ServiceError } from "@/lib/services/service-error";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    const session = await requireRole("nurse", request.headers);
    const entries = await getNurseQueue({
      userId: session.user.id,
      role: session.user.role,
    });
    return NextResponse.json({ entries } satisfies NurseQueueResponse, { headers });
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
    console.error("Nurse intake queue request failed.");
    return NextResponse.json(
      { error: "Unable to load the intake queue." },
      { status: 500, headers }
    );
  }
}
