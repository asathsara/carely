import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { listPrescriptionMedicines } from "@/lib/services/prescription";
import { ServiceError } from "@/lib/services/service-error";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    const session = await requireRole("doctor", request.headers);
    const catalogue = await listPrescriptionMedicines({
      userId: session.user.id,
      role: session.user.role,
    });
    return Response.json(catalogue, { headers });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthError || error instanceof ServiceError) {
      return Response.json(
        { error: error.message },
        { status: error.statusCode, headers }
      );
    }
    console.error("Prescription catalogue read failed.");
    return Response.json(
      { error: "Unable to load the medicine catalogue." },
      { status: 500, headers }
    );
  }
}
