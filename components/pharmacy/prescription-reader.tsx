"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { writePharmacy } from "./pharmacy-api";
import type { PrescriptionResponse } from "@/lib/schemas/prescription";
export function PrescriptionReader() {
  const [id, setId] = useState("");
  const [data, setData] = useState<PrescriptionResponse["prescription"] | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function load(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setData(null);
    setPending(true);
    try {
      const response = await fetch(`/api/prescriptions/${encodeURIComponent(id.trim())}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load prescription.");
      setData(result.prescription);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load prescription.");
    } finally {
      setPending(false);
    }
  }

  async function dispense() {
    if (!data || pending || data.status !== "issued") return;
    if (!window.confirm("Dispense this prescription? This will deduct stock.")) return;

    setMessage("");
    setPending(true);
    try {
      await writePharmacy(`/api/pharmacy/prescriptions/${data.id}/dispense`, "POST", {});
      setData({ ...data, status: "dispensed" });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to dispense prescription."
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <form onSubmit={load} className="flex gap-3 rounded-xl border p-4">
        <input
          value={id}
          onChange={(event) => setId(event.target.value)}
          placeholder="Prescription UUID"
          aria-label="Prescription ID"
          className="min-w-0 flex-1 rounded-md border px-3"
          disabled={pending}
          required
        />
        <Button type="submit" disabled={pending}>
          Find prescription
        </Button>
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
          <div className="mt-5">
            {data.status === "dispensed" ? (
              <p role="status" className="text-sm font-semibold">
                Dispensed
              </p>
            ) : (
              <Button type="button" onClick={dispense} disabled={pending}>
                {pending ? "Dispensing..." : "Dispense prescription"}
              </Button>
            )}
          </div>
        </section>
      )}
    </>
  );
}
