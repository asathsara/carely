import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { getOwnQueueStatus } from "@/lib/services/queue";
import { ServiceError } from "@/lib/services/service-error";

const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  try {
    const session = await requireRole("patient", request.headers);
    return NextResponse.json(
      {
        ...(await getOwnQueueStatus({
          userId: session.user.id,
          role: session.user.role,
        })),
      },
      { headers }
    );
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthError || error instanceof ServiceError)
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode, headers }
      );
    console.error("Patient queue request failed:", error);
    return NextResponse.json(
      { error: "Unable to load queue status." },
      { status: 500, headers }
    );
  }
}
