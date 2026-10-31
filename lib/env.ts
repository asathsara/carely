import { appEnvSchema, type AppEnv } from "./schemas/env";

function validateAppEnv(): AppEnv {
  const result = appEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment variables:", result.error.format());
    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid application environment configuration in production.");
    }
  }

  return (result.data || process.env) as AppEnv;
}

export const env = validateAppEnv();
