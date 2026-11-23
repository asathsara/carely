import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { doctorSpecialtySchema } from "@/lib/schemas/admin-config";
import { changeDoctorSpecialty } from "@/lib/services/specialty";
import { ServiceError } from "@/lib/services/service-error";

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const caller = await requireRole("admin", request.headers);
    const parsed = doctorSpecialtySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Validation error", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { userId } = await params;
    const doctor = await changeDoctorSpecialty(userId, parsed.data.specialtyId, { userId: caller.user.id, role: caller.user.role });
    return NextResponse.json({ doctor });
  } catch (error) {
    if (error instanceof AuthError || error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error("PATCH /api/admin/doctors/[userId]/specialty error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
