import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "bg-secondary text-secondary-foreground inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
