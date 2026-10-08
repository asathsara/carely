import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.ComponentProps<"input"> & {
  label: string;
  error?: string;
  showLabel?: boolean;
  endAdornment?: React.ReactNode;
  controlSize?: "default" | "compact";
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      error,
      id,
      label,
      showLabel = false,
      endAdornment,
      controlSize = "default",
      ...props
    },
    ref
  ) => (
    <div className="space-y-1.5">
      {showLabel ? (
        <label htmlFor={id} className="text-foreground block text-xs font-semibold">
          {label}
        </label>
      ) : (
        <label className="sr-only" htmlFor={id}>
          {label}
        </label>
      )}
      <div
        className={cn(
          "bg-card focus-within:border-primary focus-within:ring-ring/10 flex items-center rounded-lg border px-3.5 transition-colors focus-within:ring-2",
          controlSize === "compact" ? "min-h-11" : "min-h-12 sm:min-h-14",
          error && "border-destructive focus-within:border-destructive"
        )}
      >
        <input
          ref={ref}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "text-foreground placeholder:text-muted-foreground w-full min-w-0 bg-transparent text-sm font-medium outline-none",
            className
          )}
          {...props}
        />
        {endAdornment ? (
          <div className="ml-2 flex shrink-0 items-center">{endAdornment}</div>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  )
);
Input.displayName = "Input";

export { Input };
