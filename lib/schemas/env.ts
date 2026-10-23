import { z } from "zod";


//Base environment schema for the running web application.
export const appEnvSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection URL"),
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  BETTER_AUTH_URL: z
    .url("BETTER_AUTH_URL must be a valid URL")
    .default("http://localhost:3000"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().default("Carely Hospital <no-reply@carely.local>"),
  HOSPITAL_NAME: z.string().default("Carely Hospital"),
});

export type AppEnv = z.infer<typeof appEnvSchema>;

export const seedAdminEnvSchema = appEnvSchema.extend({
  ADMIN_EMAIL: z.email("ADMIN_EMAIL must be a valid email address"),
  ADMIN_PASSWORD: z
    .string()
    .min(12, "ADMIN_PASSWORD must be at least 12 characters long with no default fallback"),
});

export type SeedAdminEnv = z.infer<typeof seedAdminEnvSchema>;
