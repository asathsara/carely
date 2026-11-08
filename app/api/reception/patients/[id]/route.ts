import { NextResponse } from "next/server";
import {
  receptionError,
  receptionHeaders,
  requireReceptionSession,
} from "@/lib/reception-http";
import { receptionPatientIdSchema } from "@/lib/schemas/reception";
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
