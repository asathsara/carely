import { BookingBrowser } from "@/components/patient/booking-browser";
import { PageTitle } from "@/components/workspace/workspace-ui";
import { requireRole } from "@/lib/auth-guard";
import { listPatientVisitReasons } from "@/lib/services/visit-reason";

export default async function PatientBookPage() {
  await requireRole("patient");
  const reasons = await listPatientVisitReasons();
  return (
    <>
      <PageTitle
        eyebrow="Appointments"
        title="Find a doctor"
        description="Choose why you need care, then select a matched doctor and clinic date."
      />
      <BookingBrowser reasons={reasons} />
    </>
  );
}
