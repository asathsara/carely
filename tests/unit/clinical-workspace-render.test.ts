import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ poll: vi.fn() }));
vi.mock("@/lib/hooks/use-visible-polling", () => ({ useVisiblePolling: mocks.poll }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
import { ConsultationQueue } from "@/components/doctor/consultation-queue";
import { IntakeWorkspace } from "@/components/nurse/intake-workspace";
import type { NurseQueueEntry } from "@/lib/schemas/intake";
const entry: NurseQueueEntry = {
  id: "queue-id",
  encounterId: "encounter-id",
  status: "waiting",
  checkedInAt: "2026-11-14T04:00:00Z",
  appointmentId: "appointment-id",
  appointmentNo: 7,
  doctorId: "doctor-id",
  doctorName: "Doctor Example",
  patient: { id: "patient-id", patientNo: "P0001", fullName: "Patient Example" },
};
beforeEach(() =>
  mocks.poll.mockReturnValue({
    data: null,
    error: null,
    loading: false,
    refresh: vi.fn(),
  })
);
it("renders actual selected patient and a single combined intake form without fixture values", () => {
  const html = renderToStaticMarkup(
    createElement(IntakeWorkspace, {
      initialEntries: [entry],
      selectedId: entry.encounterId,
      receipt: null,
      initialError: null,
    })
  );
  expect(html).toContain("Patient Example");
  expect(html).toContain('name="heartRate"');
  expect(html).toContain('name="complaint"');
  expect(html).toContain('name="preliminaryNote"');
  expect(html.match(/<form/g)).toHaveLength(1);
  expect(html).not.toMatch(
    /Allergies|Known condition|demo session|N\. Fernando|APT-1050/
  );
});
it("does not render clinical inputs after a saved handoff", () => {
  const html = renderToStaticMarkup(
    createElement(IntakeWorkspace, {
      initialEntries: [],
      selectedId: "",
      receipt: { encounterId: entry.encounterId, recordedAt: entry.checkedInAt },
      initialError: null,
    })
  );
  expect(html).toContain("Intake saved");
  expect(html).not.toContain("<form");
  expect(html).not.toContain("Patient Example");
});
it("offers opening only for intake-complete visits", () => {
  mocks.poll.mockReturnValue({
    data: {
      entries: [
        { ...entry, queueEntryId: entry.id, status: "waiting", hasClinicalNote: false },
      ],
    },
    refresh: vi.fn(),
  });
  expect(renderToStaticMarkup(createElement(ConsultationQueue))).not.toContain(
    "Open consultation"
  );
  mocks.poll.mockReturnValue({
    data: {
      entries: [
        {
          ...entry,
          queueEntryId: entry.id,
          status: "intake_done",
          hasClinicalNote: false,
        },
      ],
    },
    refresh: vi.fn(),
  });
  expect(renderToStaticMarkup(createElement(ConsultationQueue))).toContain(
    "Open consultation"
  );
});
it("disables completion until a clinical note exists", () => {
  mocks.poll.mockReturnValue({
    data: {
      entries: [
        {
          ...entry,
          queueEntryId: entry.id,
          status: "with_doctor",
          hasClinicalNote: false,
        },
      ],
    },
    refresh: vi.fn(),
  });
  const html = renderToStaticMarkup(createElement(ConsultationQueue));
  expect(html).toMatch(/<button[^>]*disabled[^>]*>Complete consultation<\/button>/);
  expect(html).toContain("Record a clinical note");
});
