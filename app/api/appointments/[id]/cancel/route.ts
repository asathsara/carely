import { NextResponse } from "next/server";
import {
  appointmentError,
  appointmentHeaders,
  requireAppointmentSession,
} from "@/lib/appointment-http";
import { cancelAppointment } from "@/lib/services/booking";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAppointmentSession(request);
    const { id } = await params;
    const result = await cancelAppointment({
      appointmentId: id,
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json(result, {
      status: result.success ? 200 : (result.statusCode ?? 400),
      headers: appointmentHeaders,
    });
  } catch (error) {
    return appointmentError(error);
  }
}
