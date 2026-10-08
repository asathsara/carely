"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appContent } from "@/lib/mock/content";
import { doctorClinicalNoteSchema, type DoctorClinicalNote } from "@/lib/schemas/screens";

const fields: { name: keyof DoctorClinicalNote; label: string; multiline?: boolean }[] = [
  { name: "complaint", label: "Chief complaint" },
  { name: "observations", label: "Observations", multiline: true },
  { name: "assessment", label: "Assessment", multiline: true },
  { name: "plan", label: "Plan", multiline: true },
];

function DoctorClinicalNoteForm({
  defaultValues,
  medications,
}: {
  defaultValues: DoctorClinicalNote;
  medications: { name: string; dose: string }[];
}) {
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DoctorClinicalNote>({
    defaultValues,
    resolver: zodResolver(doctorClinicalNoteSchema),
  });
  const onSubmit = async (values: DoctorClinicalNote) => {
    console.log(`${appContent.brand.name} clinical note`, values);
    setMessage("Clinical note saved locally.");
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]"
    >
      <section className="bg-card flex flex-col rounded-xl border p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-semibold">Consultation note</h2>
        <div className="space-y-4">
          {fields.map((field) => (
            <label key={field.name} className="block space-y-2">
              <span className="text-sm font-medium">{field.label}</span>
              {field.multiline ? (
                <textarea
                  rows={field.name === "observations" ? 4 : 3}
                  className="bg-carely-surface focus:border-primary focus:ring-ring/10 w-full resize-none rounded-md border p-3 text-sm outline-none focus:ring-2"
                  {...register(field.name)}
                />
              ) : (
                <input
                  className="bg-carely-surface focus:border-primary focus:ring-ring/10 h-11 w-full rounded-md border px-3 text-sm outline-none focus:ring-2"
                  {...register(field.name)}
                />
              )}
              {errors[field.name] ? (
                <span className="text-destructive text-xs">
                  {errors[field.name]?.message}
                </span>
              ) : null}
            </label>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <span className="text-carely-success text-sm" role="status">
            {message}
          </span>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save clinical note"}
          </Button>
        </div>
      </section>
      <div className="space-y-4">
        <section className="bg-card rounded-xl border p-4">
          <h2 className="mb-4 text-lg font-semibold">Vitals</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["BP", "118 / 72", "mmHg"],
              ["HR", "76", "bpm"],
              ["SpO₂", "98", "%"],
              ["Temp", "36.8", "°C"],
            ].map(([label, value, unit]) => (
              <div key={label}>
                <p className="text-muted-foreground mb-1 text-xs">{label}</p>
                <div className="bg-carely-surface flex items-center justify-between rounded-md border px-3 py-3">
                  <strong className="text-sm">{value}</strong>
                  <span className="text-muted-foreground text-xs">{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-card rounded-xl border p-4">
          <h2 className="mb-4 text-lg font-semibold">Prescription</h2>
          <Input
            id="medicine-search"
            label="Search medicine"
            placeholder="Search medicine..."
          />
          <div className="mt-3 space-y-2">
            {medications.map((medicine) => (
              <div
                key={medicine.name}
                className="bg-carely-surface flex items-center justify-between rounded-md p-3"
              >
                <div>
                  <p className="text-sm font-semibold">{medicine.name}</p>
                  <p className="text-muted-foreground text-xs">{medicine.dose}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${medicine.name}`}
                  className="text-destructive"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" fullWidth className="mt-4">
            <Plus />
            Add medicine
          </Button>
        </section>
      </div>
    </form>
  );
}

export { DoctorClinicalNoteForm };
