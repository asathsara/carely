"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCheck2,
  PackageCheck,
  Search,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { demoPeople } from "@/lib/mock/content";
import { cn } from "@/lib/utils";

type AuditCategory = "Patient" | "Clinical" | "Inventory" | "Security";

type AuditEntry = {
  id: string;
  time: string;
  action: string;
  description: string;
  actor: string;
  actorRole: string;
  resource: string;
  category: AuditCategory;
};

const auditEntries: AuditEntry[] = [
  {
    id: "EVT-01882",
    time: "10:18:42",
    action: "PATIENT_CREATE",
    description: "Created a new patient record",
    actor: "M. Perera",
    actorRole: "Receptionist",
    resource: "P-0182",
    category: "Patient",
  },
  {
    id: "EVT-01881",
    time: "10:12:08",
    action: "CLINICAL_NOTE_SIGN",
    description: "Signed and locked a clinical note",
    actor: demoPeople.primaryDoctor.name,
    actorRole: "Doctor",
    resource: "P-0142",
    category: "Clinical",
  },
  {
    id: "EVT-01880",
    time: "10:06:31",
    action: "STOCK_UPDATE",
    description: "Updated medicine stock quantity",
    actor: "A. Silva",
    actorRole: "Pharmacist",
    resource: "MED-0042",
    category: "Inventory",
  },
  {
    id: "EVT-01879",
    time: "09:54:12",
    action: "ALERT_ESCALATE",
    description: "Escalated a patient priority alert",
    actor: "N. Fernando",
    actorRole: "Nurse",
    resource: "P-0161",
    category: "Clinical",
  },
  {
    id: "EVT-01878",
    time: "09:42:27",
    action: "STAFF_LOGIN",
    description: "Authenticated from a recognized device",
    actor: "S. Jayasinghe",
    actorRole: "Nurse",
    resource: "Session 7F2A",
    category: "Security",
  },
  {
    id: "EVT-01877",
    time: "09:31:04",
    action: "ROLE_PERMISSION_UPDATE",
    description: "Updated pharmacist access permissions",
    actor: "System Admin",
    actorRole: "Administrator",
    resource: "ROLE-PHARMACY",
    category: "Security",
  },
];

const categoryStyles: Record<AuditCategory, string> = {
  Patient: "bg-carely-info text-primary",
  Clinical: "bg-carely-success-soft text-carely-success",
  Inventory: "bg-[#fff6df] text-[#a86600]",
  Security: "bg-red-50 text-red-600",
};

function AuditIcon({ category }: { category: AuditCategory }) {
  const Icon =
    category === "Patient"
      ? UserPlus
      : category === "Clinical"
        ? FileCheck2
        : category === "Inventory"
          ? PackageCheck
          : ShieldAlert;

  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg",
        categoryStyles[category]
      )}
    >
      <Icon size={17} />
    </span>
  );
}

function AuditTrail() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | AuditCategory>("All");

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return auditEntries.filter((entry) => {
      const matchesCategory = category === "All" || entry.category === category;
      const matchesQuery =
        !normalizedQuery ||
        [
          entry.action,
          entry.description,
          entry.actor,
          entry.actorRole,
          entry.resource,
          entry.id,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));

      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const exportAuditLog = () => {
    const headings = ["Event ID", "Time", "Action", "Actor", "Role", "Resource"];
    const rows = filteredEntries.map((entry) => [
      entry.id,
      entry.time,
      entry.action,
      entry.actor,
      entry.actorRole,
      entry.resource,
    ]);
    const csv = [headings, ...rows]
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "carely-audit-log.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const securityEvents = auditEntries.filter(
    (entry) => entry.category === "Security"
  ).length;
  const clinicalEvents = auditEntries.filter(
    (entry) => entry.category === "Clinical"
  ).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Events today", auditEntries.length.toString()],
          ["Security events", securityEvents.toString()],
          ["Clinical events", clinicalEvents.toString()],
          ["Integrity status", "Verified"],
        ].map(([label, value], index) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "size-2 rounded-full",
                  index === 3 ? "bg-carely-success" : "bg-primary"
                )}
              />
              <p className="text-muted-foreground text-xs font-medium">{label}</p>
            </div>
            <p className="mt-2 text-xl font-bold">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto]">
          <Input
            id="auditFilter"
            label="Search audit log"
            placeholder="Search action, actor, ID or resource"
            controlSize="compact"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            endAdornment={<Search className="text-muted-foreground" size={17} />}
          />
          <Select
            value={category}
            onValueChange={(value) => {
              if (value) setCategory(value as "All" | AuditCategory);
            }}
          >
            <SelectTrigger className="min-h-11 sm:min-h-11" aria-label="Event category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All categories</SelectItem>
              <SelectItem value="Patient">Patient</SelectItem>
              <SelectItem value="Clinical">Clinical</SelectItem>
              <SelectItem value="Inventory">Inventory</SelectItem>
              <SelectItem value="Security">Security</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="justify-start md:justify-center">
            <CalendarDays />
            Today
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold">Activity log</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              {filteredEntries.length} of {auditEntries.length} events shown
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportAuditLog}>
            <Download />
            Export CSV
          </Button>
        </div>

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="min-w-72">
                    <div className="flex items-center gap-3">
                      <AuditIcon category={entry.category} />
                      <div>
                        <p className="text-foreground text-xs font-bold tracking-wide">
                          {entry.action}
                        </p>
                        <p className="mt-1 text-xs">{entry.description}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-foreground font-semibold whitespace-nowrap">
                      {entry.actor}
                    </p>
                    <p className="mt-1 text-xs">{entry.actorRole}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-foreground font-mono text-xs font-semibold">
                      {entry.resource}
                    </p>
                    <p className="mt-1 text-[10px]">{entry.id}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {entry.time}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className="bg-carely-success-soft text-carely-success">
                      Success
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="divide-y md:hidden">
          {filteredEntries.map((entry) => (
            <article key={entry.id} className="p-4">
              <div className="flex items-start gap-3">
                <AuditIcon category={entry.category} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-bold tracking-wide break-all">
                      {entry.action}
                    </p>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {entry.time}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {entry.description}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Actor</p>
                      <p className="mt-1 font-semibold">{entry.actor}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Resource</p>
                      <p className="mt-1 font-mono font-semibold">{entry.resource}</p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {filteredEntries.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="font-semibold">No matching events</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Change the search term or event category.
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t px-4 py-3 sm:px-5">
          <p className="text-muted-foreground text-xs">Today · Newest first</p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" disabled aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="bg-secondary grid size-8 place-items-center rounded-md text-xs font-semibold">
              1
            </span>
            <Button variant="ghost" size="icon" disabled aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export { AuditTrail };
