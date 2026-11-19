"use client";

import { useVisiblePolling } from "@/lib/hooks/use-visible-polling";
import type { MedicineCatalogueResponse } from "@/lib/schemas/pharmacy";

export function useMedicineCatalogue() {
  return useVisiblePolling<MedicineCatalogueResponse>("/api/pharmacy/medicines");
}

export async function writePharmacy(
  url: string,
  method: "POST" | "PATCH",
  body: unknown
) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to save changes.");
  return result;
}
