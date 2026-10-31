"use client";
import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { DoctorFinder } from "@/components/patient/doctor-finder";
import { AppointmentBooking } from "@/components/patient/appointment-booking";
import type { PatientDoctorOption } from "@/lib/schemas/booking";

export function BookingBrowser({ doctors }: { doctors: PatientDoctorOption[] }) {
  const [doctor, setDoctor] = useState<PatientDoctorOption | null>(null);
  const booking = useRef<HTMLElement>(null);
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <Card className="min-w-0 p-5 sm:p-6">
        <DoctorFinder
          doctors={doctors}
          selectedId={doctor?.id}
          onSelect={(selected) => {
            setDoctor(selected);
            requestAnimationFrame(() =>
              booking.current?.scrollIntoView({ behavior: "smooth", block: "start" })
            );
          }}
        />
      </Card>
      <Card ref={booking} className="min-w-0 scroll-mt-5 p-5 sm:p-6">
        {doctor ? (
          <AppointmentBooking key={doctor.id} doctor={doctor} />
        ) : (
          <>
            <h2 className="font-semibold">Book appointment</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Choose a doctor to see available clinic dates.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
