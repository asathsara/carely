"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { writePharmacy } from "./pharmacy-api";
import type {
  DispensingEligibility,
  PharmacistPrescriptionView,
  PrescriptionResponse,
} from "@/lib/schemas/prescription";

const eligibilityLabels: Record<DispensingEligibility["status"], string> = {
  ready: "Ready to dispense",
  dispensed: "Dispensed",
  empty: "Nothing to dispense",
  insufficient_stock: "Insufficient stock",
};

async function readPrescription(id: string) {
  const response = await fetch(`/api/prescriptions/${encodeURIComponent(id)}`);
  const result: PrescriptionResponse & { error?: string } = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to load prescription.");
  return result.prescription;
}

export function PrescriptionReader() {
  const [id, setId] = useState("");
  const [data, setData] = useState<PharmacistPrescriptionView | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function load(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setData(null);
    setPending(true);
    try {
      setData(await readPrescription(id.trim()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load prescription.");
    } finally {
      setPending(false);
    }
  }

  async function dispense() {
    if (!data || pending || data.dispensing.status !== "ready") return;
    if (!window.confirm("Dispense this prescription? This will deduct stock.")) return;

    setMessage("");
    setPending(true);
    try {
      await writePharmacy(`/api/pharmacy/prescriptions/${data.id}/dispense`, "POST", {});
      setData({ ...data, status: "dispensed", dispensing: { status: "dispensed" } });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to dispense prescription."
      );
      setData(await readPrescription(data.id).catch(() => null));
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
              <article key={item.id} className="bg-muted rounded-md p-3">
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
          <div className="mt-5 space-y-2">
            <p role="status" className="text-sm font-semibold">
              {eligibilityLabels[data.dispensing.status]}
            </p>
            {data.dispensing.status === "insufficient_stock" && (
              <p className="text-destructive text-sm">
                Short on {data.dispensing.shortMedicines.join(", ")}.
              </p>
            )}
            {data.dispensing.status !== "dispensed" && (
              <Button
                type="button"
                onClick={dispense}
                disabled={pending || data.dispensing.status !== "ready"}
              >
                {pending ? "Dispensing..." : "Dispense prescription"}
              </Button>
            )}
          </div>
        </section>
      )}
    </>
  );
}
