import { Panel } from "@/components/workspace/workspace-ui";
import type { NurseQueueEntry } from "@/lib/schemas/intake";

export function PatientContext({ entry }: { entry: NurseQueueEntry }) {
  return (
    <Panel title="Selected visit">
      <dl className="space-y-4 text-sm">
        {[
          ["Patient", entry.patient.fullName],
          ["Patient number", entry.patient.patientNo],
          ["Appointment", `#${entry.appointmentNo}`],
          ["Doctor", entry.doctorName],
          [
            "Checked in",
            new Date(entry.checkedInAt).toLocaleTimeString("en-GB", {
              timeZone: "Asia/Colombo",
              hour: "2-digit",
              minute: "2-digit",
            }),
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
