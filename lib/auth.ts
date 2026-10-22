import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "@/lib/db";
import { account, session, user, verification } from "@/lib/db/schema/auth";
import { sendPatientVerificationEmail } from "@/lib/mail";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user: unverifiedUser, url }) => {
      await sendPatientVerificationEmail({
        to: unverifiedUser.email,
        name: unverifiedUser.name,
        verificationUrl: url,
      });
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "patient",
        input: false,
      },
    },
  },
  plugins: [admin()],
});
