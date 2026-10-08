"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appContent } from "@/lib/mock/content";

const resetSchema = z.object({ email: z.email("Enter a valid email address") });
type ResetInput = z.infer<typeof resetSchema>;

function PasswordResetForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetInput>({
    defaultValues: { email: "" },
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (values: ResetInput) => {
    console.log(`${appContent.brand.name} password reset`, values);
    await new Promise((resolve) => setTimeout(resolve, 250));
    setSent(true);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <Input
        id="resetEmail"
        label="Email address"
        placeholder="Enter your verified email"
        type="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <Button fullWidth type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send reset link"}
      </Button>
      {sent ? (
        <p className="text-primary text-sm" role="status">
          Reset-link delivery is simulated for this UI prototype.
        </p>
      ) : null}
      <Link
        className="text-primary block text-center text-sm font-semibold"
        href="/login"
      >
        Back to sign in
      </Link>
    </form>
  );
}

export { PasswordResetForm };
