import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type AuthCardProps = { children: ReactNode; description: string; title: string };

function AuthCard({ children, description, title }: AuthCardProps) {
  return (
    <Card className="border-border/80 bg-card w-full max-w-xl p-5 shadow-sm sm:p-8 lg:p-10">
      <CardHeader className="space-y-1.5 sm:space-y-2">
        <h2 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h2>
        <p className="text-muted-foreground text-xs leading-relaxed font-normal sm:text-sm">
          {description}
        </p>
      </CardHeader>
      <CardContent className="mt-5 sm:mt-6">{children}</CardContent>
    </Card>
  );
}

export { AuthCard };
