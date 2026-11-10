"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  receptionDoctors,
  receptionBookings,
  receptionQueues,
  type ReceptionBooking,
} from "@/lib/mock/reception";

type ReceptionState = {
  doctors: typeof receptionDoctors;
  bookings: ReceptionBooking[];
  checkIn: (bookingId: string) => string | null;
};
const ReceptionContext = createContext<ReceptionState | null>(null);
/** Remaining demo check-in state; replace when the check-in UI uses the API. */
export function ReceptionDemoProvider({ children }: { children: ReactNode }) {
  const doctors = receptionDoctors;
  const [bookings, setBookings] = useState(receptionBookings);
  const [queues, setQueues] = useState(receptionQueues);
  function checkIn(bookingId: string) {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking || booking.status !== "Booked") return null;
    const doctor = doctors.find((item) => item.id === booking.doctorId)!;
    const queue = queues.find((item) => item.doctorId === doctor.id)!;
    const last = Math.max(
      Number(queue.serving.split("-").at(-1)),
      ...queue.patients.map((item) => Number(item.token.split("-").at(-1)))
    );
    const token = `${doctor.prefix}-${last + 1}`;
    setBookings((previous) =>
      previous.map((item) =>
        item.id === bookingId ? { ...item, status: "Checked in", token } : item
      )
    );
    setQueues((previous) =>
      previous.map((item) =>
        item.doctorId === doctor.id
          ? {
              ...item,
              patients: [
                ...item.patients,
                {
                  id: booking.id,
                  name: booking.patientName,
                  token,
                  priority: "Normal",
                  status: "Waiting",
                },
              ],
            }
          : item
      )
    );
    return token;
  }
  return (
    <ReceptionContext.Provider value={{ doctors, bookings, checkIn }}>
      {children}
    </ReceptionContext.Provider>
  );
}
export function useReceptionDemo() {
  const state = useContext(ReceptionContext);
  if (!state) throw new Error("Reception UI requires ReceptionDemoProvider");
  return state;
}
