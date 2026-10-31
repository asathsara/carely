"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InitialAvatar } from "@/components/patient/patient-shared";
import type { PatientDoctorOption } from "@/lib/schemas/booking";
import { cn } from "@/lib/utils";

export function DoctorFinder({
  doctors,
  selectedId,
  onSelect,
}: {
  doctors: PatientDoctorOption[];
  selectedId?: string;
  onSelect: (doctor: PatientDoctorOption) => void;
}) {
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("");
  const specialties = Array.from(
    new Set(
      doctors
        .map((doctor) => doctor.specialtyName)
        .filter((value): value is string => value !== null)
    )
  ).sort();
  const visible = doctors.filter(
    (doctor) =>
      (!specialty || doctor.specialtyName === specialty) &&
      `${doctor.name} ${doctor.specialtyName ?? ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
  );
  return (
    <div className="space-y-5">
      <Input
        id="patient-doctor-search"
        label="Search doctor or specialty"
        showLabel
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search doctors..."
      />
      <div className="flex flex-wrap gap-2" aria-label="Specialty filters">
        {["", ...specialties].map((value) => (
          <Button
            key={value}
            size="sm"
            variant={specialty === value ? "default" : "outline"}
            aria-pressed={specialty === value}
            onClick={() => setSpecialty(value)}
          >
            {value || "All specialties"}
          </Button>
        ))}
      </div>
      <section className="space-y-3" aria-live="polite">
        <h2 className="font-semibold">Doctors ({visible.length})</h2>
        {visible.map((doctor) => (
          <article
            key={doctor.id}
            className={cn(
              "flex flex-wrap items-center gap-4 rounded-xl border p-4",
              selectedId === doctor.id && "border-primary bg-carely-surface"
            )}
          >
            <InitialAvatar>
              {doctor.name
                .split(" ")
                .filter(Boolean)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </InitialAvatar>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{doctor.name}</h3>
              <p className="text-muted-foreground text-sm">
                {doctor.specialtyName ?? "General clinic"}
              </p>
            </div>
            <Button
              variant={selectedId === doctor.id ? "default" : "outline"}
              onClick={() => onSelect(doctor)}
              aria-label={`Choose ${doctor.name}`}
            >
              {selectedId === doctor.id ? "Selected" : "Choose doctor"}
            </Button>
          </article>
        ))}
        {!visible.length && (
          <p className="text-muted-foreground text-sm">
            No doctors match your search. Try another specialty or contact reception.
          </p>
        )}
      </section>
    </div>
  );
}
