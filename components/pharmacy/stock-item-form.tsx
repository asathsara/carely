"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { writePharmacy } from "./pharmacy-api";
import type { MedicineStockView } from "@/lib/schemas/pharmacy";

export function StockItemForm({
  medicine,
  today,
  onSaved,
}: {
  medicine: MedicineStockView;
  today: string;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError("");
    setMessage("");
    try {
      await writePharmacy(`/api/pharmacy/medicines/${medicine.id}/batches`, "POST", {
        batchNo: String(data.get("batchNo")).trim(),
        expiryDate: String(data.get("expiryDate")),
        quantity: Number(data.get("quantity")),
      });
      form.reset();
      setMessage("Stock batch received.");
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to receive stock.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {!medicine.isActive && (
        <p role="status" className="text-sm">
          Activate this medicine in the catalogue before receiving stock.
        </p>
      )}
      <fieldset
        disabled={pending || !medicine.isActive}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Input
          id="stock-batch"
          name="batchNo"
          label="Batch number"
          showLabel
          required
          maxLength={80}
        />
        <Input
          id="stock-expiry"
          name="expiryDate"
          label="Expiry date"
          showLabel
          type="date"
          min={today}
          required
        />
        <Input
          id="stock-quantity"
          name="quantity"
          label="Quantity received"
          showLabel
          type="number"
          min={0}
          max={2147483647}
          step={1}
          required
        />
        <div className="self-end">
          <Button type="submit" disabled={pending || !medicine.isActive}>
            {pending ? "Receiving..." : "Receive batch"}
          </Button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-primary text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
