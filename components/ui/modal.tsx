"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ModalProps = {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
};

function Modal({ children, description, onClose, open, title }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="bg-foreground/35 fixed inset-0 z-50 grid place-items-center p-4"
      role="presentation"
    >
      <section
        aria-describedby={description ? "modal-description" : undefined}
        aria-labelledby="modal-title"
        aria-modal="true"
        className="bg-card w-full max-w-lg rounded-xl border p-6 shadow-xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 id="modal-title" className="text-lg font-bold">
              {title}
            </h2>
            {description ? (
              <p id="modal-description" className="text-muted-foreground text-sm">
                {description}
              </p>
            ) : null}
          </div>
          <Button aria-label="Close modal" onClick={onClose} size="icon" variant="ghost">
            <X />
          </Button>
        </header>
        <div className="mt-6">{children}</div>
      </section>
    </div>
  );
}

export { Modal };
