import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { ServiceError } from "@/lib/services/service-error";

export const pharmacyHeaders = { "Cache-Control": "no-store" };

export async function requirePharmacist(request: Request, write = false) {
  if (write) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      throw new AuthError("Cross-origin stock changes are not allowed.", 403);
    }
  }
  const session = await requireRole("pharmacist", request.headers);
  return { userId: session.user.id, role: session.user.role };
}

export function pharmacyError(error: unknown) {
  unstable_rethrow(error);
  if (error instanceof AuthError || error instanceof ServiceError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode, headers: pharmacyHeaders }
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Provide valid medicine or batch details.", details: error.flatten() },
      { status: 400, headers: pharmacyHeaders }
    );
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: pharmacyHeaders }
    );
  }
  console.error("Pharmacy request failed.");
  return NextResponse.json(
    { error: "Unable to complete the pharmacy request. Please try again." },
    { status: 500, headers: pharmacyHeaders }
  );
}
