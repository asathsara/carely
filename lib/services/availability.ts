import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { doctor } from "@/lib/db/schema/doctor";
import { doctorAvailability } from "@/lib/db/schema/doctor-availability";
import type { SaveAvailabilityInput } from "@/lib/schemas/availability";

export class AvailabilityServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AvailabilityServiceError";
  }
}

async function getActiveDoctorId(userId: string): Promise<string> {
  const [profile] = await db
    .select({
      id: doctor.id,
      isActive: doctor.isActive,
      banned: user.banned,
      role: user.role,
    })
    .from(doctor)
    .innerJoin(user, eq(doctor.userId, user.id))
    .where(eq(doctor.userId, userId))
    .limit(1);

  if (!profile) {
    throw new AvailabilityServiceError(
      "Doctor profile not found. Please contact your administrator.",
      404
    );
  }

  if (!profile.isActive || profile.banned || profile.role !== "doctor") {
    throw new AvailabilityServiceError(
      "Your doctor account is inactive or unavailable.",
      403
    );
  }

  return profile.id;
}

export async function getDoctorAvailability(userId: string) {
  const doctorId = await getActiveDoctorId(userId);

  return db
    .select()
    .from(doctorAvailability)
    .where(eq(doctorAvailability.doctorId, doctorId))
    .orderBy(asc(doctorAvailability.dayOfWeek));
}

export async function saveDoctorAvailability(
  userId: string,
  input: SaveAvailabilityInput
) {
  const doctorId = await getActiveDoctorId(userId);

  // One statement saves all submitted weekdays atomically and preserves existing row IDs.
  // These rows will also be used by the booking engine for capacity locks.
  const saved = await db
    .insert(doctorAvailability)
    .values(input.sessions.map((session) => ({ ...session, doctorId })))
    .onConflictDoUpdate({
      target: [doctorAvailability.doctorId, doctorAvailability.dayOfWeek],
      set: {
        startTime: sql`excluded.start_time`,
        endTime: sql`excluded.end_time`,
        maxPatients: sql`excluded.max_patients`,
        isActive: sql`excluded.is_active`,
      },
    })
    .returning();

  return saved.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}
