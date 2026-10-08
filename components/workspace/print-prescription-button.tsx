"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function PrintPrescriptionButton({
  className,
  label = "Print prescription",
  variant = "default",
}: {
  className?: string;
  label?: string;
  variant?: "default" | "outline";
}) {
  return (
    <Button
      className={cn("w-full sm:w-42.5", className)}
      variant={variant}
      type="button"
      onClick={() => window.print()}
    >
      {label}
    </Button>
  );
}

export { PrintPrescriptionButton };
