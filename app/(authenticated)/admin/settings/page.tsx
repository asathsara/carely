import type { Metadata } from "next";
import { HospitalDetailsForm } from "@/components/admin/hospital-details-form";
import { PageTitle } from "@/components/workspace/workspace-ui";

export const metadata: Metadata = { title: "System Settings" };
export const instant = false;

export default function AdminSettingsPage() {
  return (
    <>
      <PageTitle
        eyebrow="Administration"
        title="System Settings"
        description="Manage hospital details."
      />
      <div className="max-w-3xl">
        <HospitalDetailsForm />
      </div>
    </>
  );
}
