import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { saveAvailabilitySchema } from "@/lib/schemas/availability";
import {
  AvailabilityServiceError,
  getDoctorAvailability,
  saveDoctorAvailability,
} from "@/lib/services/availability";

function errorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof AvailabilityServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  console.error("Doctor availability request failed:", error);
  return NextResponse.json(
    { error: "Unable to access your schedule. Please try again." },
    { status: 500 }
  );
}

export async function GET(request: Request) {
  try {
    const session = await requireRole("doctor", request.headers);
    const availability = await getDoctorAvailability(session.user.id);
    return NextResponse.json(
      { availability },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole("doctor", request.headers);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const parsed = saveAvailabilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Please check your clinic hours and patient capacity.",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const availability = await saveDoctorAvailability(session.user.id, parsed.data);
    return NextResponse.json(
      { availability },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
