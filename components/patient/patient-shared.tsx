import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const patientMedicines = [
  {
    code: "AM",
    name: "Amoxicillin",
    form: "500 mg capsule",
    dose: "1 capsule · three times daily",
    note: "Take after meals · 5 days",
  },
  {
    code: "PA",
    name: "Paracetamol",
    form: "500 mg tablet",
    dose: "2 tablets · when required",
    note: "Maximum 3 times per day",
  },
  {
    code: "OM",
    name: "Omeprazole",
    form: "20 mg capsule",
    dose: "1 capsule · once daily",
    note: "Take before breakfast · 7 days",
  },
] as const;

export function StatusBadge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "green" | "amber";
}) {
  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-0 px-2.5 py-1 text-xs font-medium shadow-none",
        tone === "green" && "bg-carely-success-soft text-carely-success",
        tone === "blue" && "bg-carely-surface text-primary border-primary/20 border",
        tone === "amber" && "border border-amber-200 bg-amber-100 text-amber-900"
      )}
    >
      <span
        className={cn(
          "inline-block size-1.5 rounded-full",
          tone === "green" && "bg-carely-success",
          tone === "blue" && "bg-primary",
          tone === "amber" && "bg-amber-600"
        )}
      />
      {children}
    </Badge>
  );
}

export function InitialAvatar({
  children,
  large = false,
}: {
  children: ReactNode;
  large?: boolean;
}) {
  return (
    <span
      className={cn(
        "bg-secondary text-primary grid shrink-0 place-items-center font-bold",
        large
          ? "size-12 rounded-full text-base sm:size-14 sm:text-lg"
          : "size-8 rounded-lg text-xs"
      )}
    >
      {children}
    </span>
  );
}

export function FactCard({
  label,
  value,
  surface = false,
}: {
  label: string;
  value: string;
  surface?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5",
        surface ? "bg-carely-surface min-h-28" : "bg-card"
      )}
    >
      <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
        {label}
      </p>
      <p className="text-foreground mt-1.5 text-xs font-semibold sm:text-sm">{value}</p>
    </div>
  );
}

export function StepGuide({
  number,
  title,
  copy,
}: {
  number: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="flex gap-3">
      <InitialAvatar>{number}</InitialAvatar>
      <div>
        <p className="text-foreground text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{copy}</p>
      </div>
    </div>
  );
}

export function SegmentedTabs({
  active,
  inactive,
  fullWidth = false,
}: {
  active: string;
  inactive: string;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-card mb-5 flex h-11 gap-1.5 rounded-xl border p-1 shadow-xs sm:h-12",
        fullWidth ? "w-full" : "w-fit"
      )}
    >
      <button
        type="button"
        className="bg-primary text-primary-foreground rounded-lg px-4 text-xs font-semibold transition-colors sm:px-5 sm:text-sm"
      >
        {active}
      </button>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground rounded-lg px-4 text-xs font-medium transition-colors sm:px-5 sm:text-sm"
      >
        {inactive}
      </button>
    </div>
  );
}
