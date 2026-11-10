import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PatientProfileForm } from "@/components/patient/patient-profile";
import { patientContactDraft, buildPatientProfilePatch } from "@/lib/patient-profile";
import { savedPatientProfile as profile } from "../helpers/patient-profile";

describe("Persisted patient profile", () => {
  it("submits only edited contacts and preserves the emergency phone by default", () => {
    const draft = patientContactDraft(profile);
    expect(buildPatientProfilePatch(profile, draft)).toBeNull();
    expect(buildPatientProfilePatch(profile, { ...draft, phone: "0773333333" })).toEqual({
      phone: "0773333333",
    });
    expect(
      buildPatientProfilePatch(profile, { ...draft, emergencyContactPhone: "" })
    ).toEqual({ emergencyContactPhone: null });
  });
  it("does not turn unchanged nullable contacts into implicit clears", () => {
    const empty = { ...profile, address: null, emergencyContactPhone: null };
    expect(
      buildPatientProfilePatch(empty, {
        ...patientContactDraft(empty),
        phone: "0773333333",
      })
    ).toEqual({ phone: "0773333333" });
  });
  it("renders stored details with read-only identity and separate emergency contact inputs", () => {
    const html = renderToStaticMarkup(
      createElement(PatientProfileForm, { profile, onSave: vi.fn() })
    );
    expect(html).toContain(profile.patientNo);
    expect(html).toContain(profile.fullName);
    expect(html).toContain(profile.emergencyContactPhone!);
    expect(html).not.toContain("PT-20481");
    expect(html).not.toContain("demo visit");
    for (const id of ["fullName", "dateOfBirth", "email", "gender"]) {
      const input = html.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>'))?.[0];
      expect(input).toContain("readOnly");
    }
    expect(html).toContain('id="emergencyContactName"');
    expect(html).toContain('id="emergencyContactPhone"');
  });
});
