import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { settingsSchema } from "@/lib/schemas/admin-config";
import { getSettings, updateSettings } from "@/lib/services/settings";
import { ServiceError } from "@/lib/services/service-error";

export async function GET(request: Request) {
  try {
    await requireRole("admin", request.headers);
    return NextResponse.json({ settings: await getSettings() });
  } catch (error) {
    if (error instanceof AuthError || error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error("GET /api/admin/settings error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const caller = await requireRole("admin", request.headers);
    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Validation error", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const settings = await updateSettings(parsed.data, { userId: caller.user.id, role: caller.user.role });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof AuthError || error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error("PUT /api/admin/settings error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
