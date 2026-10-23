import { boolean, pgTable, smallint, time, unique, uuid } from "drizzle-orm/pg-core";
import { doctor } from "./doctor";

export const doctorAvailability = pgTable(
  "doctor_availability",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctor.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(), // 0 = Sunday, 6 = Saturday
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    maxPatients: smallint("max_patients").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [
    unique("doctor_availability_doctor_day_unique").on(table.doctorId, table.dayOfWeek),
  ]
);

export type DoctorAvailability = typeof doctorAvailability.$inferSelect;
export type NewDoctorAvailability = typeof doctorAvailability.$inferInsert;
