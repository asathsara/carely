"use client";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/workspace/workspace-ui";
import type { PatientPrescriptionsResponse } from "@/lib/schemas/prescription";
export default function PatientPrescriptionsPage() {
  const [items, setItems] = useState<PatientPrescriptionsResponse["prescriptions"]>([]);
  const [message, setMessage] = useState("Loading prescriptions…");
  useEffect(() => {
    void fetch("/api/patient/prescriptions")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setItems(d.prescriptions);
        setMessage("");
      })
      .catch((e: unknown) =>
        setMessage(e instanceof Error ? e.message : "Unable to load prescriptions.")
      );
  }, []);
  return (
    <>
      <PageTitle
        eyebrow="My medication"
        title="Prescriptions"
        description="Review prescriptions issued for your visits."
      />
      {message && <p role="status">{message}</p>}
      {!message && !items.length && <p>No prescriptions have been issued yet.</p>}
      <div className="space-y-5">
        {items.map((p) => (
          <section key={p.id} className="rounded-xl border p-5">
            <h2 className="font-semibold">Prescription</h2>
            <p className="text-muted-foreground text-sm break-all">
              Prescription ID {p.id}
            </p>
            <p className="text-muted-foreground text-sm">
              Issued {new Date(p.createdAt).toLocaleString()}
            </p>
            {p.items.map((i) => (
              <article key={i.id} className="bg-muted mt-3 rounded-md p-3">
                <p className="font-medium">
                  {i.name}
                  {i.strength && ` ${i.strength}`}
                </p>
                {i.medicineId === null && (
                  <p className="text-muted-foreground text-sm">
                    Outside catalogue · Buy outside the hospital pharmacy
                  </p>
                )}
                <p className="text-sm">
                  {i.dosage} · {i.frequency} · {i.durationDays} days · Qty {i.quantity}
                </p>
                {i.instructions && <p className="text-sm">{i.instructions}</p>}
              </article>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
