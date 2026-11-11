import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { queueQuerySchema } from "@/lib/schemas/queue";
import { getStaffQueue } from "@/lib/services/queue";
import { ServiceError } from "@/lib/services/service-error";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    const session = await requireRole(
      ["receptionist", "nurse", "doctor"],
      request.headers
    );
    const url = new URL(request.url);
    const parsed = queueQuerySchema.safeParse({
      doctorId: url.searchParams.get("doctorId"),
      date: url.searchParams.get("date"),
    });
    if (!parsed.success)
      return NextResponse.json(
        { error: "Provide a doctor ID and date." },
        { status: 400, headers }
      );
    const entries = await getStaffQueue({
      ...parsed.data,
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ entries }, { headers });
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
    console.error("Queue request failed:", error);
    return NextResponse.json(
      { error: "Unable to load queue." },
      { status: 500, headers }
    );
  }
}
