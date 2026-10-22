"use client";

import { CheckCircle2, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { authClient } from "@/lib/auth-client";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  useEffect(() => {
    if (!session) return;

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
  }, [session, router]);

  return (
    <AuthShell
      artwork={{
        alt: "Email verified successfully",
        height: 120,
        src: "/images/patient-profile.svg",
        width: 104,
      }}
    >
      <AuthCard
        title="Email Verified"
        description="Your patient account has been verified and activated."
      >
        <div className="space-y-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">
              Verification Successful
            </h3>
            <p className="text-sm text-muted-foreground">
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
    </AuthShell>
  );
}
