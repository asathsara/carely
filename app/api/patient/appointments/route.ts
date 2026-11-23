import { NextResponse } from "next/server";
import {
  appointmentError,
  appointmentHeaders,
  requireAppointmentSession,
} from "@/lib/appointment-http";
import { patientBookingSchema } from "@/lib/schemas/booking";
import { bookAppointment } from "@/lib/services/booking";
import { getPatientAppointments } from "@/lib/services/patient-booking";
import { getOrCreatePatientForUser } from "@/lib/services/patient";

export async function GET(request: Request) {
  try {
    const session = await requireAppointmentSession(request, ["patient"]);
    const appointments = await getPatientAppointments(session.user.id);
    return NextResponse.json({ appointments }, { headers: appointmentHeaders });
  } catch (error) {
    return appointmentError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAppointmentSession(request, ["patient"]);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers: appointmentHeaders }
      );
    }
    const parsed = patientBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Choose a valid reason, doctor, and appointment date." },
        { status: 400, headers: appointmentHeaders }
      );
    }
    const profile = await getOrCreatePatientForUser(session.user.id);
    const result = await bookAppointment({
      ...parsed.data,
      patientId: profile.id,
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json(result, {
      status: result.success ? 201 : (result.statusCode ?? 400),
      headers: appointmentHeaders,
    });
  } catch (error) {
    return appointmentError(error);
  }
}
