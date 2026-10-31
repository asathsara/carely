import { date, index, pgSequence, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const patientNoSeq = pgSequence("patient_no_seq", {
  startWith: 1,
  increment: 1,
});

export const patient = pgTable(
  "patient",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "set null" })
      .unique(),
    patientNo: text("patient_no").notNull().unique(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    gender: text("gender"),
    address: text("address"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
  },
  (table) => [
    index("patient_full_name_idx").on(table.fullName),
    index("patient_phone_idx").on(table.phone),
    index("patient_patient_no_idx").on(table.patientNo),
  ]
);

export type Patient = typeof patient.$inferSelect;
export type NewPatient = typeof patient.$inferInsert;
