import { NextResponse } from "next/server";
import {
  receptionError,
  receptionHeaders,
  requireReceptionSession,
} from "@/lib/reception-http";
import { patientSearchSchema } from "@/lib/schemas/reception";
import { searchReceptionPatients } from "@/lib/services/reception";

export async function GET(request: Request) {
  try {
    await requireReceptionSession(request);
    const input = patientSearchSchema.safeParse({
      q: new URL(request.url).searchParams.get("q") ?? "",
    });
    if (!input.success) {
      return NextResponse.json(
        { error: "Enter a valid patient number, phone number, or name." },
        { status: 400, headers: receptionHeaders }
      );
    }
    const patients = await searchReceptionPatients(input.data.q);
    return NextResponse.json({ patients }, { headers: receptionHeaders });
  } catch (error) {
    return receptionError(error);
  }
}
