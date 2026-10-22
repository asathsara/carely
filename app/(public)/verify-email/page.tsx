"use client";

import { CheckCircle2, ArrowRight, AlertTriangle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { authClient } from "@/lib/auth-client";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const { data: session, isPending } = authClient.useSession();
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  useEffect(() => {
    if (errorParam || !session) return;

    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/patient/onboarding");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session, router, errorParam]);

  if (errorParam) {
    return (
      <AuthCard
        title="Verification Failed"
        description="The verification link is invalid, expired, or has already been used."
      >
        <div className="space-y-6 text-center">
          <div className="bg-destructive/10 text-destructive mx-auto flex size-14 items-center justify-center rounded-full">
            <AlertTriangle className="size-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-foreground text-base font-semibold">
              Link Expired or Invalid
            </h3>
            <p className="text-muted-foreground text-sm">
              Please sign in to request a fresh verification link, or register a new
              account.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button fullWidth onClick={() => router.push("/login")}>
              Go to Sign in
            </Button>
            <Button variant="outline" fullWidth onClick={() => router.push("/signup")}>
              Create New Account
            </Button>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Email Verified"
      description="Your patient account has been verified and activated."
    >
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="size-8" />
        </div>

        <div className="space-y-2">
          <h3 className="text-foreground text-base font-semibold">
            Verification Successful
          </h3>
          <p className="text-muted-foreground text-sm">
            {isPending
              ? "Confirming session details…"
              : session
                ? `Welcome, ${session.user.name}. Redirecting to patient onboarding in ${redirectCountdown}s…`
                : "Your email has been verified. You can now sign in to your patient account."}
          </p>
        </div>

        <div className="pt-2">
          {session ? (
            <Button fullWidth onClick={() => router.push("/patient/onboarding")}>
              Continue to Onboarding <ArrowRight className="ml-2 size-4" />
            </Button>
          ) : (
            <Button fullWidth onClick={() => router.push("/login")}>
              Sign in to Portal <ArrowRight className="ml-2 size-4" />
            </Button>
          )}
        </div>
      </div>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell
      artwork={{
        alt: "Email verification status",
        height: 120,
        src: "/images/patient-profile.svg",
        width: 104,
      }}
    >
      <Suspense
        fallback={
          <AuthCard
            title="Verifying Account"
            description="Please wait while we confirm your email…"
          >
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground text-sm">
                Loading verification status…
              </p>
            </div>
          </AuthCard>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </AuthShell>
  );
}
