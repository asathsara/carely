import { NextResponse } from "next/server";
import {
  receptionError,
  receptionHeaders,
  requireReceptionSession,
} from "@/lib/reception-http";
import { getPatientDoctors } from "@/lib/services/patient-booking";

export async function GET(request: Request) {
  try {
    await requireReceptionSession(request);
    const doctors = await getPatientDoctors();
    return NextResponse.json({ doctors }, { headers: receptionHeaders });
  } catch (error) {
    return receptionError(error);
  }
}
