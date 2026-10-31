import { BookingBrowser } from "@/components/patient/booking-browser";
import { PageTitle } from "@/components/workspace/workspace-ui";
import { requireRole } from "@/lib/auth-guard";
import { getPatientDoctors } from "@/lib/services/patient-booking";

export default async function PatientBookPage() {
  await requireRole("patient");
  const doctors = await getPatientDoctors();
  return (
    <>
      <PageTitle
        eyebrow="Appointments"
        title="Find a doctor"
        description="Browse doctors by specialty, then choose an available clinic date."
      />
      <BookingBrowser doctors={doctors} />
    </>
  );
}
