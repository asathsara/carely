"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appContent } from "@/lib/mock/content";

type Field = { name: string; placeholder: string; type?: string };
const formSchema = z
  .record(z.string(), z.string())
  .refine(
    (values) => Object.values(values).every((value) => value.trim().length > 0),
    "Complete every field"
  );

function DemoForm({
  fields,
  submitLabel,
  columns = 2,
  compact = false,
  buttonAlign = "start",
}: {
  fields: Field[];
  submitLabel: string;
  columns?: 1 | 2;
  compact?: boolean;
  buttonAlign?: "start" | "end";
}) {
  const [message, setMessage] = useState("");
  const defaultValues = Object.fromEntries(fields.map((field) => [field.name, ""]));
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Record<string, string>>({
    defaultValues,
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (values: Record<string, string>) => {
    setMessage("");
    console.log(`${appContent.brand.name} ${submitLabel}`, values);
    await new Promise((resolve) => setTimeout(resolve, 250));
    setMessage("Saved locally for this UI prototype.");
  };

  return (
    <form
      className={columns === 1 ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}
      onSubmit={handleSubmit(onSubmit)}
    >
      {fields.map((field) => (
        <Input
          key={field.name}
          id={field.name}
          label={field.placeholder}
          placeholder={field.placeholder}
          showLabel
          controlSize={compact ? "compact" : "default"}
          type={field.type}
          {...register(field.name)}
        />
      ))}
      {errors.root ? (
        <p
          className={
            columns === 2
              ? "text-destructive text-sm sm:col-span-2"
              : "text-destructive text-sm"
          }
        >
          Complete every field.
        </p>
      ) : null}
      <div
        className={
          columns === 2
            ? `sm:col-span-2 ${buttonAlign === "end" ? "sm:text-right" : ""}`
            : buttonAlign === "end"
              ? "text-right"
              : ""
        }
      >
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
        {message ? (
          <p className="text-primary mt-2 text-sm" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export { DemoForm };
