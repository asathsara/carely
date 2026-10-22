import { date, pgSequence, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const patientNoSeq = pgSequence("patient_no_seq", {
  startWith: 1,
  increment: 1,
});

export const patient = pgTable("patient", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "set null" })
    .unique(),
  patientNo: text("patient_no").notNull().unique(),
  nic: text("nic").unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  dateOfBirth: date("date_of_birth", { mode: "string" }).notNull(),
  gender: text("gender").notNull(),
  address: text("address"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
});
