import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { visitReasonCreateSchema } from "@/lib/schemas/admin-config";
import { createVisitReason, listVisitReasons } from "@/lib/services/visit-reason";
import { ServiceError } from "@/lib/services/service-error";

export async function GET(request: Request) {
  try {
    await requireRole("admin", request.headers);
    return NextResponse.json({ reasons: await listVisitReasons() });
  } catch (error) {
    if (error instanceof AuthError || error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error("GET /api/admin/visit-reasons error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const caller = await requireRole("admin", request.headers);
    const parsed = visitReasonCreateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Validation error", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const reason = await createVisitReason(parsed.data, { userId: caller.user.id, role: caller.user.role });
    return NextResponse.json({ reason }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError || error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error("POST /api/admin/visit-reasons error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
