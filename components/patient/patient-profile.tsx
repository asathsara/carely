"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/patient/patient-shared";
import type { PatientProfile, PatientProfileUpdate } from "@/lib/schemas/patient-update";
import { buildPatientProfilePatch, patientContactDraft } from "@/lib/patient-profile";

const contactFields = [
  { key: "phone", label: "Phone number", type: "tel", maxLength: 24 },
  { key: "address", label: "Residential address", type: "text", maxLength: 240 },
  {
    key: "emergencyContactName",
    label: "Emergency contact name",
    type: "text",
    maxLength: 120,
  },
  {
    key: "emergencyContactPhone",
    label: "Emergency contact phone",
    type: "tel",
    maxLength: 24,
  },
] as const;

export function PatientProfileForm({
  profile,
  onSave,
}: {
  profile: PatientProfile;
  onSave: (changes: PatientProfileUpdate) => Promise<PatientProfile>;
}) {
  const [draft, setDraft] = useState(() => patientContactDraft(profile));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setSaved(false);
    try {
      const changes = buildPatientProfilePatch(profile, draft);
      if (!changes) return;
      setPending(true);
      const updated = await onSave(changes);
      setDraft(patientContactDraft(updated));
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your profile.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="bg-carely-surface flex items-center gap-4 rounded-xl border p-4">
        <span className="bg-primary grid size-12 shrink-0 place-items-center rounded-full font-bold text-white">
          {profile.fullName
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)}
        </span>
        <div className="min-w-0">
          <p className="font-bold wrap-break-word">{profile.fullName}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Patient ID {profile.patientNo}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge tone={profile.emailVerified ? "green" : "amber"}>
              {profile.emailVerified ? "Email verified" : "Verification pending"}
            </StatusBadge>
          </div>
        </div>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-5">
        <div className="border-b pb-3">
          <h2 className="font-semibold">Personal &amp; contact details</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Update your contact details here. Contact reception to correct your personal
            details.
          </p>
        </div>
        {saved && (
          <p
            role="status"
            className="bg-carely-success-soft text-carely-success rounded-lg p-3 text-sm"
          >
            Profile saved.
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="fullName"
            label="Full name"
            showLabel
            value={profile.fullName}
            readOnly
          />
          <Input
            id="dateOfBirth"
            label="Date of birth"
            type="date"
            showLabel
            value={profile.dateOfBirth ?? ""}
            readOnly
          />
          <Input
            id="email"
            label="Email address"
            type="email"
            showLabel
            value={profile.email}
            readOnly
          />
          <Input
            id="gender"
            label="Gender"
            showLabel
            value={profile.gender ?? ""}
            readOnly
          />
          {contactFields.map((field) => (
            <Input
              key={field.key}
              id={field.key}
              label={field.label}
              type={field.type}
              maxLength={field.maxLength}
              showLabel
              disabled={pending}
              value={draft[field.key]}
              onChange={(event) => {
                setDraft({ ...draft, [field.key]: event.target.value });
                setSaved(false);
                setError("");
              }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setDraft(patientContactDraft(profile));
              setSaved(false);
              setError("");
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}
