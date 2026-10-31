export function formatPatientDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function formatSession(start: string | null, end: string | null) {
  return start && end
    ? `${start.slice(0, 5)} – ${end.slice(0, 5)} (Colombo)`
    : "Contact reception for clinic hours";
}

export function appointmentStatus(status: string) {
  return (
    (
      { booked: "Booked", cancelled: "Cancelled", completed: "Completed" } as Record<
        string,
        string
      >
    )[status] ?? "In progress"
  );
}
