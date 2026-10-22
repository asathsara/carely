"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AtSign, CheckCircle2, Mail, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { INLINE_ICON_SIZE } from "@/lib/constants/ui";
import type { SignupInput } from "@/lib/schemas/auth";
import { signupSchema } from "@/lib/schemas/auth";

const RESEND_COOLDOWN_SECONDS = 60;

function SignupForm({ defaultValues }: { defaultValues: SignupInput }) {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    defaultValues,
    resolver: zodResolver(signupSchema),
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const onSubmit = async (values: SignupInput) => {
    setServerError(null);
    try {
      const { error } = await authClient.signUp.email({
        email: values.email,
        password: values.password,
        name: values.name,
        callbackURL: "/verify-email",
      });

      if (error) {
        setServerError(error.message || "Failed to create account. Please try again.");
        return;
      }

      setSubmittedEmail(values.email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setServerError("An unexpected error occurred. Please try again.");
    }
  };

  const handleResend = async () => {
    if (!submittedEmail || cooldown > 0 || isResending) return;
    setIsResending(true);
    setResendSuccess(false);
    setServerError(null);

    try {
      const { error } = await authClient.sendVerificationEmail({
        email: submittedEmail,
        callbackURL: "/verify-email",
      });

      if (error) {
        setServerError(error.message || "Failed to resend verification link.");
      } else {
        setResendSuccess(true);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } catch {
      setServerError("Could not resend email. Please try again later.");
    } finally {
      setIsResending(false);
    }
  };

  if (submittedEmail) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Mail className="size-7" />
        </div>

        <div className="space-y-2">
          <h3 className="text-foreground text-lg font-semibold">Check your email</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We sent a verification link to{" "}
            <span className="text-foreground font-medium">{submittedEmail}</span>. Please
            verify your email address before continuing.
          </p>
        </div>

        {serverError ? (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            {serverError}
          </div>
        ) : null}

        {resendSuccess ? (
          <div className="flex items-center justify-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
            <CheckCircle2 className="size-4" />
            Verification email resent successfully!
          </div>
        ) : null}

        {process.env.NODE_ENV === "development" ? (
          <div className="border-border/60 bg-muted/30 text-muted-foreground rounded-lg border p-4 text-xs">
            <p className="text-foreground font-medium">Local Development Mode</p>
            <p className="mt-1">
              Emails are delivered to your local Mailpit instance. Check{" "}
              <a
                href="http://localhost:8025"
                target="_blank"
                rel="noreferrer"
                className="text-primary font-medium underline"
              >
                http://localhost:8025
              </a>{" "}
              to view and click your link.
            </p>
          </div>
        ) : null}

        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
          >
            {isResending ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="size-4 animate-spin" /> Resending…
              </span>
            ) : cooldown > 0 ? (
              `Resend email in ${cooldown}s`
            ) : (
              "Resend verification email"
            )}
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">
          Wrong email address?{" "}
          <button
            type="button"
            onClick={() => setSubmittedEmail(null)}
            className="text-primary font-medium hover:underline"
          >
            Start over
          </button>
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      {serverError ? (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {serverError}
        </div>
      ) : null}

      <div className="space-y-3">
        <Input
          id="name"
          label="Full name"
          placeholder="Enter your full legal name"
          autoComplete="name"
          error={errors.name?.message}
          {...register("name")}
        />

        <Input
          id="signupEmail"
          label="Email address"
          placeholder="Enter your email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <Input
          id="signupPassword"
          label="Password"
          placeholder="Create a password (min. 8 characters)"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <Input
          id="confirmPassword"
          label="Confirm password"
          placeholder="Repeat your password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
      </div>

      <div className="bg-carely-info flex gap-3.5 rounded-lg px-4 py-3.5">
        <div className="bg-card text-primary grid size-10 shrink-0 place-items-center rounded-full">
          <AtSign size={INLINE_ICON_SIZE} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">Verification link required</p>
          <p className="text-muted-foreground text-xs leading-relaxed font-normal">
            A confirmation link will be sent to your email to verify and activate your
            patient account.
          </p>
        </div>
      </div>

      <Button fullWidth type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-primary text-center text-xs font-semibold">
        Already registered?{" "}
        <Link className="hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export { SignupForm };
