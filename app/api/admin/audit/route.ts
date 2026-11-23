import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { AuditQueryError, queryAuditLog } from "@/lib/services/audit-query";

export async function GET(request: Request) {
  try {
    await requireRole("admin", request.headers);
    const search = new URL(request.url).searchParams;
    const result = await queryAuditLog({
      user: search.get("user"),
      action: search.get("action"),
      from: search.get("from"),
      to: search.get("to"),
      page: search.get("page"),
      pageSize: search.get("pageSize"),
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthError || error instanceof AuditQueryError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/admin/audit failed.");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
