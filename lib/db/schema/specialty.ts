import { pgTable, text, uuid } from "drizzle-orm/pg-core";

export const specialty = pgTable("specialty", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
});

export type Specialty = typeof specialty.$inferSelect;
export type NewSpecialty = typeof specialty.$inferInsert;
