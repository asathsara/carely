import { NextResponse } from "next/server";
import {
  receptionError,
  receptionHeaders,
  requireReceptionSession,
} from "@/lib/reception-http";
import { receptionBookingSchema } from "@/lib/schemas/reception";
import { bookAppointment } from "@/lib/services/booking";

export async function POST(request: Request) {
  try {
    const session = await requireReceptionSession(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers: receptionHeaders }
      );
    }
    const parsed = receptionBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Choose a valid patient, doctor, and appointment date." },
        { status: 400, headers: receptionHeaders }
      );
    }
    const result = await bookAppointment({
      ...parsed.data,
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json(result, {
      status: result.success ? 201 : (result.statusCode ?? 400),
      headers: receptionHeaders,
    });
  } catch (error) {
    return receptionError(error);
  }
}
