import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointment } from "@/lib/db/schema/appointment";
import { user } from "@/lib/db/schema/auth";
import { doctor } from "@/lib/db/schema/doctor";
import { doctorAvailability } from "@/lib/db/schema/doctor-availability";
import { patient } from "@/lib/db/schema/patient";
import {
  bookAppointmentSchema,
  type BookAppointmentParams,
  type BookAppointmentResult,
  type CancelAppointmentParams,
  type OpenDatesResponse,
} from "@/lib/schemas/booking";

const colomboClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Colombo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function colomboNow() {
  const parts = Object.fromEntries(
    colomboClock.formatToParts(new Date()).map(({ type, value }) => [type, value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

function failure(code: string, error: string, statusCode = 400): BookAppointmentResult {
  return { success: false, code, error, statusCode };
}

function isTokenConflict(error: unknown): boolean {
  // Drizzle wraps the postgres-js error in a query error's cause.
  if (!error || typeof error !== "object") return false;
  if (
    "code" in error &&
    error.code === "23505" &&
    "constraint_name" in error &&
    error.constraint_name === "appointment_doctor_date_no_unique"
  ) {
    return true;
  }
  return "cause" in error && isTokenConflict(error.cause);
}

/**
 * Called only by trusted server code with an actor derived from the session.
 * Patient callers must resolve/provision their profile before passing patientId.
 * The availability row serializes all bookings for this doctor and weekday.
 */
export async function bookAppointment(
  params: BookAppointmentParams
): Promise<BookAppointmentResult> {
  const input = bookAppointmentSchema.safeParse(params);
  if (!input.success) {
    return failure("INVALID_INPUT", input.error.issues[0].message);
  }

  const actor = params.actor;
  if (!actor || typeof actor.userId !== "string" || !actor.userId.trim()) {
    return failure("UNAUTHORIZED", "A signed-in user is required", 401);
  }
  if (!["patient", "receptionist", "admin"].includes(actor.role)) {
    return failure("FORBIDDEN", "You cannot book appointments", 403);
  }

  const { doctorId, patientId, date } = input.data;
  // UTC arithmetic determines the weekday of the date label, independent of host TZ.
  const dayOfWeek = new Date(`${date}T00:00:00.000Z`).getUTCDay();

  try {
    return await db.transaction(
      async (tx): Promise<BookAppointmentResult> => {
        const [caller] = await tx
          .select({ role: user.role, banned: user.banned })
          .from(user)
          .where(eq(user.id, actor.userId))
          .limit(1);
        if (!caller || caller.banned || caller.role !== actor.role) {
          return failure("FORBIDDEN", "Your account cannot book appointments", 403);
        }

        const [targetPatient] = await tx
          .select({ userId: patient.userId })
          .from(patient)
          .where(eq(patient.id, patientId))
          .limit(1);
        if (actor.role === "patient" && targetPatient?.userId !== actor.userId) {
          return failure("FORBIDDEN", "You can only book your own appointments", 403);
        }
        if (!targetPatient) {
          return failure("PATIENT_NOT_FOUND", "Patient not found", 404);
        }

        const [targetDoctor] = await tx
          .select({
            isActive: doctor.isActive,
            consultationFee: doctor.consultationFee,
            banned: user.banned,
            role: user.role,
          })
          .from(doctor)
          .innerJoin(user, eq(doctor.userId, user.id))
          .where(eq(doctor.id, doctorId))
          .limit(1);
        if (!targetDoctor) {
          return failure("DOCTOR_NOT_FOUND", "Doctor not found", 404);
        }
        if (
          !targetDoctor.isActive ||
          targetDoctor.banned ||
          targetDoctor.role !== "doctor"
        ) {
          return failure("DOCTOR_INACTIVE", "Doctor is currently inactive");
        }

        const [availability] = await tx
          .select()
          .from(doctorAvailability)
          .where(
            and(
              eq(doctorAvailability.doctorId, doctorId),
              eq(doctorAvailability.dayOfWeek, dayOfWeek)
            )
          )
          .for("update");
        if (!availability?.isActive) {
          return failure(
            "NO_ACTIVE_SESSION",
            "Doctor has no active clinic on this weekday"
          );
        }

        // Read the clock after acquiring the lock: a queued request may cross end_time.
        const now = colomboNow();
        if (date < now.date) {
          return failure("PAST_DATE", "Cannot book an appointment in the past");
        }
        if (date === now.date && now.time >= availability.endTime) {
          return failure("SESSION_ENDED", "Today's clinic session has already ended");
        }

        const [totals] = await tx
          .select({
            activeCount:
              sql<number>`count(*) filter (where ${appointment.status} <> 'cancelled')`.mapWith(
                Number
              ),
            lastNumber:
              sql<number>`coalesce(max(${appointment.appointmentNo}), 0)`.mapWith(Number),
          })
          .from(appointment)
          .where(
            and(eq(appointment.doctorId, doctorId), eq(appointment.appointmentDate, date))
          );
        if (totals.activeCount >= availability.maxPatients) {
          return failure("SESSION_FULL", "Session is fully booked", 409);
        }

        const [created] = await tx
          .insert(appointment)
          .values({
            doctorId,
            patientId,
            appointmentDate: date,
            appointmentNo: totals.lastNumber + 1,
            status: "booked",
            source: actor.role === "patient" ? "online" : "reception",
            bookedBy: actor.userId,
            feeAmount: targetDoctor.consultationFee,
          })
          .returning();

        return {
          success: true,
          appointment: created,
          appointmentNo: created.appointmentNo,
        };
      },
      { isolationLevel: "read committed" }
    );
  } catch (error) {
    if (isTokenConflict(error)) {
      return failure("TOKEN_CONFLICT", "Token slot conflict, please retry", 409);
    }
    throw error;
  }
}

/**
 * Step 0 Contract Stub for listing open dates for a doctor.
 */
export async function getOpenDatesForDoctor(
  _doctorId: string
): Promise<OpenDatesResponse> {
  throw new Error(
    "getOpenDatesForDoctor is not implemented yet (scheduled for Track 2)."
  );
}

/**
 * Step 0 Contract Stub for cancelling an appointment.
 */
export async function cancelAppointment(
  _params: CancelAppointmentParams
): Promise<{ success: boolean; error?: string }> {
  throw new Error("cancelAppointment is not implemented yet (scheduled for Track 2).");
}
