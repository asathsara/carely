import { boolean, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { specialty } from "./specialty";

export const doctor = pgTable("doctor", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  specialtyId: uuid("specialty_id").references(() => specialty.id, {
    onDelete: "set null",
  }),
  regNo: text("reg_no"),
  consultationFee: numeric("consultation_fee", { precision: 10, scale: 2 }),
  bio: text("bio"),
  isActive: boolean("is_active").default(true).notNull(),
});

export const doctorProfile = doctor;
export type Doctor = typeof doctor.$inferSelect;
export type NewDoctor = typeof doctor.$inferInsert;
