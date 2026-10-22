import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema/*",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://carely_user:carely_password@localhost:5432/carely_db",
  },
});
