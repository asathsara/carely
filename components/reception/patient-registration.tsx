"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/workspace/workspace-ui";
import type {
  ReceptionPatientDetails,
  ReceptionPatientSummary,
} from "@/lib/schemas/reception";

type RegistrationValues = {
  fullName: string;
  dateOfBirth?: string;
  phone?: string;
  address?: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

function compact(values: RegistrationValues) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== "")
  );
}

export function PatientRegistration() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<ReceptionPatientSummary[]>([]);
  const [selected, setSelected] = useState<ReceptionPatientDetails | null>(null);
  const [searchError, setSearchError] = useState("");
  const [registrationError, setRegistrationError] = useState("");
  const [pending, setPending] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<
    ReceptionPatientSummary[]
  >([]);
  const [registrationDraft, setRegistrationDraft] = useState<RegistrationValues | null>(
    null
  );
  const [created, setCreated] = useState<ReceptionPatientSummary | null>(null);

  function continueWith(patientId: string) {
    router.push(`/reception/channeling?patientId=${encodeURIComponent(patientId)}`);
  }

  async function loadDetails(patientId: string) {
    try {
      const response = await fetch(
        `/api/reception/patients/${encodeURIComponent(patientId)}`,
        {
          cache: "no-store",
        }
      );
      const data: { patient?: ReceptionPatientDetails; error?: string } =
        await response.json();
      if (!response.ok || !data.patient)
        throw new Error(data.error ?? "Unable to load patient.");
      setSelected(data.patient);
      setSearchError("");
    } catch (cause) {
      setSearchError(cause instanceof Error ? cause.message : "Unable to load patient.");
    }
  }

  async function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    setPending(true);
    setSearchError("");
    setSelected(null);
    try {
      const response = await fetch(
        `/api/reception/patients/search?q=${encodeURIComponent(term)}`,
        {
          cache: "no-store",
        }
      );
      const data: { patients?: ReceptionPatientSummary[]; error?: string } =
        await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to search patients.");
      setPatients(data.patients ?? []);
      if ((data.patients?.length ?? 0) === 0)
        setSearchError("No matching patient records.");
    } catch (cause) {
      setPatients([]);
      setSearchError(
        cause instanceof Error ? cause.message : "Unable to search patients."
      );
    } finally {
      setPending(false);
    }
  }

  function readRegistration(event: FormEvent<HTMLFormElement>): RegistrationValues {
    const data = new FormData(event.currentTarget);
    return {
      fullName: String(data.get("fullName") ?? "").trim(),
      dateOfBirth: String(data.get("dateOfBirth") ?? "") || undefined,
      phone: String(data.get("phone") ?? "").trim() || undefined,
      address: String(data.get("address") ?? "").trim() || undefined,
    };
  }

  async function register(values: RegistrationValues, confirmDuplicate = false) {
    setPending(true);
    setRegistrationError("");
    try {
      const response = await fetch("/api/reception/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...compact(values), confirmDuplicate }),
      });
      const data: {
        patient?: ReceptionPatientSummary;
        duplicateCandidates?: ReceptionPatientSummary[];
        error?: string;
      } = await response.json();
      if (response.status === 409 && data.duplicateCandidates) {
        setRegistrationDraft(values);
        setDuplicateCandidates(data.duplicateCandidates);
        return;
      }
      if (!response.ok || !data.patient) {
        throw new Error(data.error ?? "Unable to register patient.");
      }
      setDuplicateCandidates([]);
      setRegistrationDraft(null);
      setCreated(data.patient);
      setSelected(null);
    } catch (cause) {
      setRegistrationError(
        cause instanceof Error ? cause.message : "Unable to register patient."
      );
    } finally {
      setPending(false);
    }
  }

  function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = readRegistration(event);
    if (!values.fullName) {
      setRegistrationError("Full name is required.");
      return;
    }
    void register(values);
  }

  return (
    <>
      <form
        onSubmit={find}
        className="bg-card mb-5 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <Input
            id="registration-search"
            label="Find patient"
            showLabel
            placeholder="Patient number, phone number, or name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            controlSize="compact"
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Searching..." : "Find patient"}
        </Button>
      </form>
      {searchError && (
        <p role="status" className="text-muted-foreground mb-4 text-sm">
          {searchError}
        </p>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Existing patient">
          {selected ? (
            <Card className="bg-secondary border-0 p-4">
              <div className="flex items-start gap-3">
                <Avatar alt={selected.fullName} fallback={initials(selected.fullName)} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{selected.fullName}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {selected.patientNo}
                  </p>
                  <p className="text-muted-foreground mt-2 text-sm">
                    DOB: {selected.dateOfBirth ?? "Not recorded"}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Phone: {selected.phone ?? "Not recorded"}
                  </p>
                  {selected.address && (
                    <p className="text-muted-foreground mt-1 text-sm">
                      {selected.address}
                    </p>
                  )}
                </div>
                <Badge>{selected.hasPortalAccount ? "Portal linked" : "Walk-in"}</Badge>
              </div>
              <Button
                fullWidth
                className="mt-4"
                onClick={() => continueWith(selected.id)}
              >
                Use this patient
              </Button>
            </Card>
          ) : patients.length > 0 ? (
            <div className="space-y-3">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => void loadDetails(patient.id)}
                  className="bg-carely-surface hover:bg-secondary w-full rounded-lg p-4 text-left transition-colors"
                >
                  <p className="font-semibold">{patient.fullName}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {patient.patientNo}
                  </p>
                  <p className="text-muted-foreground mt-2 text-xs">
                    DOB: {patient.dateOfBirth ?? "Not recorded"}
                    {patient.phone ? ` · ${patient.phone}` : ""}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-6 text-sm">
              Search by patient number, phone number, or name to find an existing record.
            </p>
          )}
        </Panel>
        <Panel title="New walk-in patient">
          <form onSubmit={submitRegistration} className="space-y-4">
            <Input
              id="registration-name"
              name="fullName"
              label="Full name"
              showLabel
              placeholder="Enter legal name"
              maxLength={120}
              autoComplete="name"
              required
            />
            <Input
              id="registration-dob"
              name="dateOfBirth"
              label="Date of birth (optional)"
              showLabel
              type="date"
              max={new Date().toISOString().slice(0, 10)}
            />
            <Input
              id="registration-phone"
              name="phone"
              label="Phone number (optional)"
              showLabel
              type="tel"
              placeholder="+94"
              autoComplete="tel"
              maxLength={24}
            />
            <Input
              id="registration-address"
              name="address"
              label="Address (optional)"
              showLabel
              placeholder="Street, city"
              autoComplete="street-address"
              maxLength={240}
            />
            {registrationError && (
              <p role="alert" className="text-destructive text-sm">
                {registrationError}
              </p>
            )}
            <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
              {pending ? "Saving..." : "Register walk-in"}
            </Button>
          </form>
        </Panel>
      </div>
      <Dialog
        open={duplicateCandidates.length > 0}
        onOpenChange={() => setDuplicateCandidates([])}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Possible duplicate record</DialogTitle>
            <DialogDescription>
              The name, date of birth, and phone number match an existing patient. Review
              the record before creating another one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {duplicateCandidates.map((patient) => (
              <Button
                key={patient.id}
                variant="outline"
                className="h-auto w-full justify-start py-3 text-left whitespace-normal"
                onClick={() => {
                  setDuplicateCandidates([]);
                  void loadDetails(patient.id);
                }}
              >
                {patient.fullName} · {patient.patientNo} ·{" "}
                {patient.dateOfBirth ?? "No DOB"}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={pending} />}>
              Go back
            </DialogClose>
            <Button
              disabled={pending || !registrationDraft}
              onClick={() => registrationDraft && void register(registrationDraft, true)}
            >
              Create new record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!created} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Patient registered</DialogTitle>
            <DialogDescription>
              A walk-in patient record has been saved.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border p-4">
            <p className="font-semibold">{created?.fullName}</p>
            <p className="text-muted-foreground mt-1 text-sm">{created?.patientNo}</p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
            <Button onClick={() => created && continueWith(created.id)}>
              Continue to channeling
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
