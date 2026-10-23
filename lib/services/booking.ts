import type {
  BookAppointmentParams,
  BookAppointmentResult,
  CancelAppointmentParams,
  OpenDatesResponse,
} from "@/lib/schemas/booking";

/**
 * Step 0 Contract Stub for bookAppointment.
 * Full implementation with row locking and monotonic token assignment
 * will be delivered in Track 2 (feat/doctor-booking).
 */
export async function bookAppointment(
  _params: BookAppointmentParams
): Promise<BookAppointmentResult> {
  throw new Error("bookAppointment is not implemented yet (scheduled for Track 2).");
}

/**
 * Step 0 Contract Stub for listing open dates for a doctor.
 */
export async function getOpenDatesForDoctor(
  _doctorId: string
): Promise<OpenDatesResponse> {
  throw new Error("getOpenDatesForDoctor is not implemented yet (scheduled for Track 2).");
}

/**
 * Step 0 Contract Stub for cancelling an appointment.
 */
export async function cancelAppointment(
  _params: CancelAppointmentParams
): Promise<{ success: boolean; error?: string }> {
  throw new Error("cancelAppointment is not implemented yet (scheduled for Track 2).");
}
