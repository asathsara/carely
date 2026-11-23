import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { specialtyCreateSchema } from "@/lib/schemas/admin-config";
import { createSpecialty, listSpecialties } from "@/lib/services/specialty";
import { ServiceError } from "@/lib/services/service-error";

export async function GET(req: Request) {
  try {
    await requireRole("admin", req.headers);
    const specialties = await listSpecialties();
    return NextResponse.json({ specialties });
  } catch (err: unknown) {
    if (err instanceof AuthError || err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("GET /api/admin/specialties error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const caller = await requireRole("admin", req.headers);
    const parsed = specialtyCreateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Validation error", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const specialty = await createSpecialty(parsed.data.name, { userId: caller.user.id, role: caller.user.role });
    return NextResponse.json({ specialty }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError || err instanceof ServiceError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    console.error("POST /api/admin/specialties error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
