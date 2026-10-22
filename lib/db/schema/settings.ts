import { sql } from "drizzle-orm";
import { jsonb, pgTable, smallint, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const hospitalSettings = pgTable(
  "hospital_settings",
  {
    id: smallint("id").primaryKey(),
    hospitalName: text("hospital_name").notNull(),
    logoUrl: text("logo_url"),
    address: text("address"),
    phone: text("phone"),
    email: text("email"),
    emergencyNumber: text("emergency_number"),
    enabledVitals: jsonb("enabled_vitals").$type<string[]>(),
    customVitals: jsonb("custom_vitals").$type<Record<string, unknown>>(),
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [sql`CONSTRAINT hospital_settings_single_row CHECK (${table.id} = 1)`]
);
