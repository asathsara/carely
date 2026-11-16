import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth-guard";
import {
  clinicalNoteEncounterParamsSchema,
  createClinicalNoteSchema,
  type ClinicalNotesResponse,
  type CreateClinicalNoteResponse,
} from "@/lib/schemas/clinical-note";
import { createClinicalNote, getClinicalNotes } from "@/lib/services/clinical-notes";
import { ServiceError } from "@/lib/services/service-error";

const headers = { "Cache-Control": "no-store" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "Cross-origin clinical note changes are not allowed." },
        { status: 403, headers }
      );
    }
    const session = await requireRole("doctor", request.headers);
    const identifier = clinicalNoteEncounterParamsSchema.safeParse(await params);
    if (!identifier.success) {
      return NextResponse.json(
        { error: "Provide a valid encounter ID." },
        { status: 400, headers }
      );
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers }
      );
    }
    const parsed = createClinicalNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Provide a valid clinical note.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400, headers }
      );
    }
    const note = await createClinicalNote({
      encounterId: identifier.data.id,
      note: parsed.data,
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ note } satisfies CreateClinicalNoteResponse, {
      status: 201,
      headers,
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthError || error instanceof ServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error instanceof ServiceError ? { code: error.code } : {}),
        },
        { status: error.statusCode, headers }
      );
    }
    // Error values can contain note text. Do not log them.
    console.error("Clinical note save failed.");
    return NextResponse.json(
      { error: "Unable to save the clinical note. Please try again." },
      { status: 500, headers }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("doctor", request.headers);
    const identifier = clinicalNoteEncounterParamsSchema.safeParse(await params);
    if (!identifier.success) {
      return NextResponse.json(
        { error: "Provide a valid encounter ID." },
        { status: 400, headers }
      );
    }
    const notes = await getClinicalNotes({
      encounterId: identifier.data.id,
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ notes } satisfies ClinicalNotesResponse, { headers });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthError || error instanceof ServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error instanceof ServiceError ? { code: error.code } : {}),
        },
        { status: error.statusCode, headers }
      );
    }
    console.error("Clinical note read failed.");
    return NextResponse.json(
      { error: "Unable to load clinical notes. Please try again." },
      { status: 500, headers }
    );
  }
}
