import { and, asc, eq, sql } from "drizzle-orm";
import { colomboNow } from "@/lib/clinic-time";
import { db } from "@/lib/db";
import { appointment } from "@/lib/db/schema/appointment";
import { user } from "@/lib/db/schema/auth";
import { doctor } from "@/lib/db/schema/doctor";
import { doctorAvailability } from "@/lib/db/schema/doctor-availability";
import { patient } from "@/lib/db/schema/patient";
import { specialty } from "@/lib/db/schema/specialty";
import {
  cancelAppointmentSchema,
  type PatientAppointmentView,
  type PatientDoctorOption,
} from "@/lib/schemas/booking";
import { BookingServiceError } from "@/lib/services/booking";

export async function getPatientDoctors(): Promise<PatientDoctorOption[]> {
  return db
    .select({
      id: doctor.id,
      name: user.name,
      specialtyName: specialty.name,
      consultationFee: doctor.consultationFee,
    })
    .from(doctor)
    .innerJoin(user, eq(doctor.userId, user.id))
    .leftJoin(specialty, eq(doctor.specialtyId, specialty.id))
    .where(
      and(
        eq(doctor.isActive, true),
        eq(user.role, "doctor"),
        sql`coalesce(${user.banned}, false) = false`
      )
    )
    .orderBy(asc(user.name), asc(doctor.id));
}

/** Filters by authenticated user ID in SQL; never accepts a client patient ID. */
export async function getPatientAppointments(
  userId: string,
  appointmentId?: string
): Promise<PatientAppointmentView[]> {
  if (
    appointmentId !== undefined &&
    !cancelAppointmentSchema.safeParse({ appointmentId }).success
  ) {
    throw new BookingServiceError("Appointment not found", 404, "APPOINTMENT_NOT_FOUND");
  }
  const [caller] = await db
    .select({ role: user.role, banned: user.banned })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!caller || caller.banned || caller.role !== "patient") {
    throw new BookingServiceError(
      "Your patient account is unavailable",
      403,
      "FORBIDDEN"
    );
  }
  const rows = await db
    .select({
      id: appointment.id,
      doctorId: appointment.doctorId,
      doctorName: user.name,
      specialtyName: specialty.name,
      date: appointment.appointmentDate,
      appointmentNo: appointment.appointmentNo,
      status: appointment.status,
      feeAmount: appointment.feeAmount,
      startTime: doctorAvailability.startTime,
      endTime: doctorAvailability.endTime,
    })
    .from(appointment)
    .innerJoin(patient, eq(appointment.patientId, patient.id))
    .innerJoin(doctor, eq(appointment.doctorId, doctor.id))
    .innerJoin(user, eq(doctor.userId, user.id))
    .leftJoin(specialty, eq(doctor.specialtyId, specialty.id))
    .leftJoin(
      doctorAvailability,
      and(
        eq(doctorAvailability.doctorId, doctor.id),
        sql`${doctorAvailability.dayOfWeek} = extract(dow from ${appointment.appointmentDate})`
      )
    )
    .where(
      and(
        eq(patient.userId, userId),
        appointmentId ? eq(appointment.id, appointmentId) : undefined
      )
    )
    .orderBy(
      asc(appointment.appointmentDate),
      asc(appointment.appointmentNo),
      asc(appointment.id)
    );
  const now = colomboNow();
  return rows.map((row) => {
    const future =
      row.date > now.date ||
      (row.date === now.date && (!row.endTime || now.time < row.endTime));
    return {
      ...row,
      isUpcoming: row.status === "booked" && future,
      canCancel: row.status === "booked" && future,
    };
  });
}
