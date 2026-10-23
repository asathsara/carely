import fs from "node:fs";

// Load environment variables before importing modules that depend on env
for (const envFile of [".env.local", ".env"]) {
  if (fs.existsSync(envFile)) {
    try {
      process.loadEnvFile(envFile);
      break;
    } catch {
      // Ignore if loadEnvFile fails
    }
  }
}

async function seedAdmin() {
  const { seedAdminEnvSchema } = await import("../lib/schemas/env");
  const result = seedAdminEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Configuration error: Invalid or missing administrator seed credentials.");
    const formatted = result.error.format();
    if (formatted.ADMIN_EMAIL?._errors) {
      console.error(`  ADMIN_EMAIL: ${formatted.ADMIN_EMAIL._errors.join(", ")}`);
    }
    if (formatted.ADMIN_PASSWORD?._errors) {
      console.error(`  ADMIN_PASSWORD: ${formatted.ADMIN_PASSWORD._errors.join(", ")}`);
    }
    process.exit(1);
  }

  const { ADMIN_EMAIL, ADMIN_PASSWORD } = result.data;

  const { db } = await import("../lib/db");
  const { hashPassword } = await import("better-auth/crypto");
  const { eq } = await import("drizzle-orm");
  const { account, user } = await import("../lib/db/schema/auth");

  console.log(`Checking for admin account: ${ADMIN_EMAIL}...`);

  const existing = await db
    .select()
    .from(user)
    .where(eq(user.email, ADMIN_EMAIL.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Admin user already exists (id: ${existing[0].id}). Nothing to do.`);
    process.exit(0);
  }

  console.log("Creating root system administrator...");

  const userId = crypto.randomUUID();
  const accountId = crypto.randomUUID();
  const hashedPassword = await hashPassword(ADMIN_PASSWORD);

  await db.transaction(async (tx) => {
    await tx.insert(user).values({
      id: userId,
      name: "System Administrator",
      email: ADMIN_EMAIL.toLowerCase(),
      emailVerified: true,
      role: "admin",
      banned: false,
    });

    await tx.insert(account).values({
      id: accountId,
      accountId: userId,
      providerId: "credential",
      userId: userId,
      password: hashedPassword,
    });
  });

  console.log("Root system administrator created successfully.");
  console.log(`  Email: ${ADMIN_EMAIL}`);
  console.log("  Role: admin");
  console.log("  Email Verified: true");
}

seedAdmin().catch((err) => {
  console.error("Failed to seed admin user:", err);
  process.exit(1);
});
