import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { patient } from "@/lib/db/schema/patient";
import { patientOnboardingSchema } from "@/lib/schemas/auth";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const result = patientOnboardingSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;

    // Check if patient profile already exists
    const existing = await db
      .select({ id: patient.id, patientNo: patient.patientNo })
      .from(patient)
      .where(eq(patient.userId, session.user.id))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({
        success: true,
        patientNo: existing[0].patientNo,
        message: "Patient profile already exists",
      });
    }

    // Generate sequential patient identifier (e.g. PAT-000001)
    const seqResult = await db.execute<{ seq: string }>(
      sql`SELECT nextval('patient_no_seq')::text as seq`
    );
    const rawSeq = seqResult[0]?.seq || "1";
    const patientNo = `PAT-${String(rawSeq).padStart(6, "0")}`;

    // Atomic insert with conflict handling to prevent double-click race conditions
    const [created] = await db
      .insert(patient)
      .values({
        userId: session.user.id,
        patientNo,
        fullName: data.fullName,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        address: data.address || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
      })
      .onConflictDoNothing({ target: patient.userId })
      .returning();

    if (!created) {
      // Another concurrent request already created the record; fetch and return it
      const [existingRecord] = await db
        .select()
        .from(patient)
        .where(eq(patient.userId, session.user.id))
        .limit(1);

      return NextResponse.json({
        success: true,
        patient: existingRecord,
        patientNo: existingRecord?.patientNo,
      });
    }

    return NextResponse.json({
      success: true,
      patient: created,
      patientNo: created.patientNo,
    });
  } catch (err) {
    console.error("Failed to complete patient onboarding:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
