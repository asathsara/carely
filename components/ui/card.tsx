import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      data-slot="card"
      className={cn("bg-card text-card-foreground rounded-xl border", className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: ComponentProps<"header">) {
  return <header className={cn("space-y-2", className)} {...props} />;
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(className)} {...props} />;
}

export { Card, CardContent, CardHeader };
