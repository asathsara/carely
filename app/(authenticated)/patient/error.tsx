"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function PatientError({ retry }: { retry: () => void }) {
  return (
    <Card className="space-y-4 p-6">
      <h2 className="font-semibold">Unable to load this page</h2>
      <p className="text-muted-foreground text-sm">
        Please try again. If the problem continues, contact reception.
      </p>
      <Button onClick={retry}>Try again</Button>
    </Card>
  );
}
