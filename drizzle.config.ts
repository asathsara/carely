import fs from "node:fs";
import { defineConfig } from "drizzle-kit";

for (const envFile of [".env.local", ".env"]) {
  if (fs.existsSync(envFile)) {
    try {
      process.loadEnvFile(envFile);
      break;
    } catch {
      // Ignore if cannot read
    }
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL environment variable is required for migrations.");
}

export default defineConfig({
  schema: "./lib/db/schema/*",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      databaseUrl || "postgresql://carely_user:carely_password@localhost:5432/carely_db",
  },
});
