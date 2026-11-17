import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { requireRole } from "@/lib/auth-guard";
import { getNurseQueue, getNurseIntakeReceipt } from "@/lib/services/intake";
import type { NurseIntakeReceipt, NurseQueueEntry } from "@/lib/schemas/intake";
import { IntakeWorkspace } from "@/components/nurse/intake-workspace";

export const metadata: Metadata = { title: "Nurse Intake" };
export const instant = false;

export default async function NurseVitalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole("nurse");
  const actor = { userId: session.user.id, role: session.user.role };
  const query = await searchParams;
  const selectedId = typeof query.encounterId === "string" ? query.encounterId : "";
  let entries: NurseQueueEntry[] = [];
  let receipt: NurseIntakeReceipt | null = null;
  let error: string | null = null;
  try {
    entries = await getNurseQueue(actor);
    if (typeof query.receipt === "string")
      receipt = await getNurseIntakeReceipt(query.receipt, actor);
  } catch (cause) {
    unstable_rethrow(cause);
    error =
      typeof query.receipt === "string"
        ? "Saved confirmation is unavailable for this account and date."
        : "Unable to load the intake queue. Refresh to try again.";
  }
  return (
    <IntakeWorkspace
      key={`${selectedId}:${receipt?.encounterId ?? ""}`}
      initialEntries={entries}
      selectedId={selectedId}
      receipt={receipt}
      initialError={error}
    />
  );
}
