import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle } from "@/components/workspace/workspace-ui";
import { StockEditor } from "@/components/pharmacy/stock-editor";

export const metadata: Metadata = { title: "Receive Stock" };
export const instant = false;

export default function StockEditorPage() {
  return (
    <>
      <PageTitle
        eyebrow="Pharmacy workspace"
        title="Receive Stock"
        description="Receive stock batches and review quantities and expiry dates."
      />
      <Suspense fallback={<p role="status">Loading stock...</p>}>
        <StockEditor />
      </Suspense>
    </>
  );
}
