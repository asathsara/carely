"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PrescriptionResponse } from "@/lib/schemas/prescription";
export function PrescriptionReader() {
  const [id, setId] = useState("");
  const [data, setData] = useState<PrescriptionResponse["prescription"] | null>(null);
  const [message, setMessage] = useState("");
  async function load(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setData(null);
    try {
      const response = await fetch(`/api/prescriptions/${encodeURIComponent(id)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load prescription.");
      setData(result.prescription);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load prescription.");
    }
  }
  return (
    <>
      <form onSubmit={load} className="flex gap-3 rounded-xl border p-4">
        <input
          value={id}
          onChange={(event) => setId(event.target.value)}
          placeholder="Prescription UUID"
          className="min-w-0 flex-1 rounded-md border px-3"
          required
        />
        <Button type="submit">Find prescription</Button>
      </form>
      {message && (
        <p role="alert" className="text-destructive mt-4 text-sm">
          {message}
        </p>
      )}
      {data && (
        <section className="mt-5 rounded-xl border p-5">
          <h2 className="font-semibold">Prescription</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Issued {new Date(data.createdAt).toLocaleString()}
          </p>
          <div className="mt-4 space-y-3">
            {data.items.map((item) => (
              <article key={item.medicineId} className="bg-muted rounded-md p-3">
                <p className="font-medium">
                  {item.name} {item.strength}
                </p>
                <p className="text-sm">
                  {item.dosage} · {item.frequency} · {item.durationDays} days · Qty{" "}
                  {item.quantity}
                </p>
                {item.instructions && <p className="text-sm">{item.instructions}</p>}
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
