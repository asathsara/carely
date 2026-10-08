"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AtSign } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INLINE_ICON_SIZE } from "@/lib/constants/ui";
import { appContent } from "@/lib/mock/content";
import type { SignupInput } from "@/lib/schemas/auth";
import { signupSchema } from "@/lib/schemas/auth";

function SignupForm({ defaultValues }: { defaultValues: SignupInput }) {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    defaultValues,
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (values: SignupInput) => {
    setSubmitted(false);
    console.log(`${appContent.brand.name} create account`, values);
    await new Promise((resolve) => setTimeout(resolve, 400));
    setSubmitted(true);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Input
          id="firstName"
          label="First name"
          placeholder="Enter your first name"
          autoComplete="given-name"
          error={errors.firstName?.message}
          {...register("firstName")}
        />
        <Input
          id="lastName"
          label="Last name"
          placeholder="Enter your last name"
          autoComplete="family-name"
          error={errors.lastName?.message}
          {...register("lastName")}
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
          id="phone"
          label="Phone number"
          placeholder="Enter mobile number"
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <Input
          id="signupPassword"
          label="Password"
          placeholder="Create a password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Input
          id="confirmPassword"
          label="Confirm password"
          placeholder="Repeat password"
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
          <p className="text-sm font-semibold">Email verification required</p>
          <p className="text-muted-foreground text-xs leading-relaxed font-normal">
            We will send a verification link before the account can access patient
            information.
          </p>
        </div>
      </div>
      <Button fullWidth type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
      {submitted ? (
        <p role="status" className="text-primary text-sm">
          Account details logged. Verification is simulated in this UI prototype.
        </p>
      ) : null}
      <p className="text-primary text-xs font-semibold">
        Already registered?{" "}
        <Link className="hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export { SignupForm };
