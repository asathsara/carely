import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clinicalNote } from "@/lib/db/schema/clinical-note";
import { clinicalNoteActions } from "@/lib/audit/actions/clinical-note";
import {
  clinicalNoteEncounterParamsSchema,
  createClinicalNoteSchema,
  type ClinicalNoteRecord,
  type CreateClinicalNoteInput,
  type CreatedClinicalNote,
} from "@/lib/schemas/clinical-note";
import { assertEncounterWritable } from "./encounter";
import type { Actor } from "./access-policy";
import { recordAudit } from "./audit";
import { ServiceError } from "./service-error";

function assertDoctor(actor: Actor) {
  if (actor.role !== "doctor") {
    throw new ServiceError("Only doctors can record clinical notes.", 403, "FORBIDDEN");
  }
}

function assertEncounterId(encounterId: string) {
  if (!clinicalNoteEncounterParamsSchema.safeParse({ id: encounterId }).success) {
    throw new ServiceError("Invalid encounter identifier.", 400, "INVALID_ID");
  }
}

/**
 * Appends a clinical note. The encounter lock is held through the audit write so
 * consultation completion cannot race a late note into a completed visit.
 */
export async function createClinicalNote(input: {
  encounterId: string;
  note: CreateClinicalNoteInput;
  actor: Actor;
}): Promise<CreatedClinicalNote> {
  assertDoctor(input.actor);
  assertEncounterId(input.encounterId);
  const parsed = createClinicalNoteSchema.safeParse(input.note);
  if (!parsed.success) {
    throw new ServiceError(
      "Provide a valid clinical note.",
      400,
      "INVALID_CLINICAL_NOTE"
    );
  }

  return db.transaction(async (tx) => {
    const visit = await assertEncounterWritable(input.encounterId, input.actor, tx);
    const createdAt = new Date();
    const [saved] = await tx
      .insert(clinicalNote)
      .values({
        encounterId: visit.id,
        authorId: input.actor.userId,
        content: parsed.data.content,
        createdAt,
      })
      .returning({
        id: clinicalNote.id,
        encounterId: clinicalNote.encounterId,
        content: clinicalNote.content,
        createdAt: clinicalNote.createdAt,
      });

    await recordAudit(tx, {
      actorId: input.actor.userId,
      action: clinicalNoteActions.created,
      targetType: "clinical_note",
      targetId: saved.id,
    });

    return {
      ...saved,
      createdAt: saved.createdAt.toISOString(),
    };
  });
}

/**
 * Notes are visible only to the active treating doctor while the live encounter
 * remains with that doctor. Reusing the writable assertion keeps reads from
 * exposing records after completion or to another doctor's session.
 */
export async function getClinicalNotes(input: {
  encounterId: string;
  actor: Actor;
}): Promise<ClinicalNoteRecord[]> {
  assertDoctor(input.actor);
  assertEncounterId(input.encounterId);

  return db.transaction(async (tx) => {
    const visit = await assertEncounterWritable(input.encounterId, input.actor, tx);
    const rows = await tx
      .select({
        id: clinicalNote.id,
        encounterId: clinicalNote.encounterId,
        content: clinicalNote.content,
        createdAt: clinicalNote.createdAt,
      })
      .from(clinicalNote)
      .where(eq(clinicalNote.encounterId, visit.id))
      .orderBy(asc(clinicalNote.createdAt), asc(clinicalNote.id));
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  });
}
