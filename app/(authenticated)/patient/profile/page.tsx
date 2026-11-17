import { requireRole } from "@/lib/auth-guard";
import { getOwnPatientProfile } from "@/lib/services/patient";
import { PatientProfileSettings } from "@/components/patient/patient-profile-settings";

export const instant = false;

export default async function PatientProfilePage() {
  const session = await requireRole("patient");
  const profile = await getOwnPatientProfile({
    userId: session.user.id,
    role: session.user.role,
  });
  return <PatientProfileSettings initialProfile={profile} />;
}
