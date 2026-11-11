import { NextResponse } from "next/server";
import {
  receptionError,
  receptionHeaders,
  requireReceptionSession,
} from "@/lib/reception-http";
import { receptionPatientIdSchema } from "@/lib/schemas/reception";
import { receptionistPatientUpdateSchema } from "@/lib/schemas/patient-update";
import { requireRole } from "@/lib/auth-guard";
import { ServiceError } from "@/lib/services/service-error";
import { updatePatientByReceptionist } from "@/lib/services/patient";
import { getReceptionPatientDetails } from "@/lib/services/reception";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireReceptionSession(request);
    const input = receptionPatientIdSchema.safeParse(await params);
    if (!input.success) {
      return NextResponse.json(
        { error: "Invalid patient ID." },
        { status: 400, headers: receptionHeaders }
      );
    }
    const patient = await getReceptionPatientDetails(input.data.id);
    return NextResponse.json({ patient }, { headers: receptionHeaders });
  } catch (error) {
    return receptionError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return NextResponse.json(
        { error: "Cross-origin patient changes are not allowed." },
        { status: 403, headers: receptionHeaders }
      );
    const session = await requireRole("receptionist", request.headers);
    const id = receptionPatientIdSchema.safeParse(await params);
    const body: unknown = await request.json().catch(() => null);
    const parsed = receptionistPatientUpdateSchema.safeParse(body);
    if (!id.success || !parsed.success)
      return NextResponse.json(
        { error: "Provide permitted patient fields only." },
        { status: 400, headers: receptionHeaders }
      );
    const patient = await updatePatientByReceptionist(id.data.id, parsed.data, {
      userId: session.user.id,
      role: session.user.role,
    });
    return NextResponse.json({ patient }, { headers: receptionHeaders });
  } catch (error) {
    if (error instanceof ServiceError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode, headers: receptionHeaders }
      );
    return receptionError(error);
  }
}
