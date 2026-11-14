export type NurseQueueEntry = {
  id: string;
  encounterId: string;
  status: "waiting";
  checkedInAt: string;
  appointmentId: string;
  appointmentNo: number;
  doctorId: string;
  doctorName: string;
  patient: { id: string; patientNo: string; fullName: string };
};

export type NurseQueueResponse = { entries: NurseQueueEntry[] };
