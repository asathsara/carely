import { NextResponse } from "next/server";
import {
  receptionError,
  receptionHeaders,
  requireReceptionSession,
} from "@/lib/reception-http";
import { createWalkInPatientSchema } from "@/lib/schemas/reception";
import { createWalkInPatient } from "@/lib/services/reception";

export async function POST(request: Request) {
  try {
    await requireReceptionSession(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers: receptionHeaders }
      );
    }
    const parsed = createWalkInPatientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Please provide a full name and valid patient details.",
          details: parsed.error.issues,
        },
        { status: 400, headers: receptionHeaders }
      );
    }
    const result = await createWalkInPatient(parsed.data);
    if (!result.patient) {
      return NextResponse.json(
        {
          error:
            "A matching patient record may already exist. Review it before creating another.",
          code: "DUPLICATE_POSSIBLE",
          duplicateCandidates: result.duplicateCandidates,
        },
        { status: 409, headers: receptionHeaders }
      );
    }
    return NextResponse.json(result, { status: 201, headers: receptionHeaders });
  } catch (error) {
    return receptionError(error);
  }
}
