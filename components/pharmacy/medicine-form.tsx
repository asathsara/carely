"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { writePharmacy } from "./pharmacy-api";
import type { MedicineDetails } from "@/lib/schemas/pharmacy";

export function MedicineForm({
  medicine,
  onSaved,
  onCancel,
}: {
  medicine?: MedicineDetails;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await writePharmacy(
        medicine ? `/api/pharmacy/medicines/${medicine.id}` : "/api/pharmacy/medicines",
        medicine ? "PATCH" : "POST",
        {
          name: String(data.get("name")).trim(),
          form: String(data.get("form")).trim(),
          strength: String(data.get("strength")).trim(),
          isActive: data.get("isActive") === "on",
        }
      );
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save medicine.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <fieldset disabled={pending} className="space-y-4">
        <Input
          id="medicine-name"
          name="name"
          label="Medicine name"
          showLabel
          required
          maxLength={100}
          defaultValue={medicine?.name}
        />
        <Input
          id="medicine-form"
          name="form"
          label="Form"
          placeholder="e.g. Tablet"
          showLabel
          required
          maxLength={100}
          defaultValue={medicine?.form}
        />
        <Input
          id="medicine-strength"
          name="strength"
          label="Strength"
          placeholder="e.g. 500 mg"
          showLabel
          required
          maxLength={100}
          defaultValue={medicine?.strength}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={medicine?.isActive ?? true}
          />
          Active in catalogue
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save medicine"}
        </Button>
      </div>
    </form>
  );
}
