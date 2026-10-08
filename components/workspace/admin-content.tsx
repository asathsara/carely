import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuditTrail } from "@/components/admin/audit-trail";
import {
  DataList,
  PageTitle,
  Panel,
  StatCards,
  WorkTable,
} from "@/components/workspace/workspace-ui";
import { demoPeople } from "@/lib/mock/content";
import { adminScreens } from "@/lib/mock/screens";

function AdminStaff() {
  return (
    <>
      <PageTitle
        eyebrow="Administration"
        title="Staff Management"
        description="Manage staff accounts, roles, departments and status."
      />
      <div className="bg-card mb-5 flex gap-3 rounded-xl border p-3">
        <div className="flex-1">
          <Input
            id="staffSearch"
            label="Search staff"
            placeholder="Search staff by name, email or department"
          />
        </div>
        <Button>+ Add staff member</Button>
      </div>
      <Panel title="Staff directory">
        <WorkTable
          showHeader={false}
          headers={["Name", "Role", "Department", "Status", "Action"]}
          rows={[
            [
              demoPeople.primaryDoctor.initials,
              demoPeople.primaryDoctor.name,
              `Doctor · ${demoPeople.primaryDoctor.specialty}`,
              "Active",
              "Manage",
            ],
            ["NF", "N. Fernando", "Nurse · OPD", "Active", "Manage"],
            ["AS", "A. Silva", "Pharmacist · Pharmacy", "Active", "Manage"],
            ["MP", "M. Perera", "Receptionist · Front desk", "Active", "Manage"],
            ["DA", "Dr. A. Fernando", "Doctor · General Medicine", "Inactive", "Manage"],
            ["SJ", "S. Jayasinghe", "Nurse · Emergency", "Active", "Manage"],
          ]}
        />
      </Panel>
    </>
  );
}

function AdminSettings() {
  return (
    <>
      <PageTitle
        eyebrow="Administration"
        title="System Settings"
        description="Manage staff access and role permissions for hospital operations."
      />
      <Panel title="Role permissions">
        <DataList
          variant="surface"
          items={adminScreens.settings.items.map((item) => ({
            ...item,
            status: "Edit",
          }))}
        />
        <div className="mt-8 flex justify-end">
          <Button>Save settings</Button>
        </div>
      </Panel>
    </>
  );
}

function AdminAudit() {
  return (
    <>
      <PageTitle
        eyebrow="Administration"
        title="Audit Trail"
        description="Review security and operational events across the hospital. Every entry is timestamped and read-only."
      />
      <AuditTrail />
    </>
  );
}

function AdminDashboard() {
  return (
    <>
      <PageTitle
        eyebrow="Administration"
        title="Hospital Overview"
        description="Staff and hospital operations at a glance."
      />
      <StatCards metrics={adminScreens.dashboard.metrics} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel title="Recent activity">
          <DataList variant="surface" items={adminScreens.dashboard.items} />
        </Panel>
        <Panel title="Quick actions">
          <div className="space-y-3">
            <Button fullWidth>Add staff member</Button>
            <Button fullWidth variant="outline">
              Review permissions
            </Button>
            <Button fullWidth variant="outline">
              Open audit trail
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}
export { AdminAudit, AdminDashboard, AdminSettings, AdminStaff };
