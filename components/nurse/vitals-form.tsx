"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { intakeMeasurements } from "@/lib/intake-form";

export function VitalsForm() {
  const [extras, setExtras] = useState<number[]>([]);
  const [nextId, setNextId] = useState(0);
  return (
    <fieldset className="space-y-5">
      <legend className="mb-4 text-lg font-semibold">Vitals</legend>
      <p className="text-muted-foreground text-sm">
        Record at least one measurement. Enter both values when recording blood pressure.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {intakeMeasurements.map((field) => (
          <Input
            key={field.name}
            id={field.name}
            name={field.name}
            label={field.label}
            showLabel
            type="number"
            step={field.step}
            endAdornment={
              <span className="text-muted-foreground text-xs">{field.unit}</span>
            }
          />
        ))}
      </div>
      {extras.map((id) => (
        <div
          key={id}
          className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <Input
            id={`extra-name-${id}`}
            name="additionalName"
            label="Measurement name"
            showLabel
            maxLength={40}
            placeholder="blood_glucose"
            pattern="[A-Za-z][A-Za-z0-9_]*"
            title="Start with a letter; use letters, digits and underscores."
          />
          <Input
            id={`extra-value-${id}`}
            name="additionalValue"
            label="Value and unit"
            showLabel
            maxLength={200}
            placeholder="5.4 mmol/L"
          />
          <Button
            type="button"
            variant="outline"
            aria-label="Remove additional measurement"
            onClick={() => setExtras((items) => items.filter((item) => item !== id))}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={extras.length >= 20}
        onClick={() => {
          setExtras((items) => [...items, nextId]);
          setNextId(nextId + 1);
        }}
      >
        Add measurement
      </Button>
    </fieldset>
  );
}
