import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { specialtyUpdateSchema } from "@/lib/schemas/admin-config";
import { deleteSpecialty, updateSpecialty } from "@/lib/services/specialty";
import { ServiceError } from "@/lib/services/service-error";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await requireRole("admin", request.headers);
    const parsed = specialtyUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Validation error", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { id } = await params;
    const specialty = await updateSpecialty(id, parsed.data.name, { userId: caller.user.id, role: caller.user.role });
    return NextResponse.json({ specialty });
  } catch (error) {
    if (error instanceof AuthError || error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error("PATCH /api/admin/specialties/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await requireRole("admin", request.headers);
    const { id } = await params;
    await deleteSpecialty(id, { userId: caller.user.id, role: caller.user.role });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthError || error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error("DELETE /api/admin/specialties/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
