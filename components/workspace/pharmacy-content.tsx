import {
  DataList,
  PageTitle,
  Panel,
  StatCards,
  WorkTable,
} from "@/components/workspace/workspace-ui";
import { DemoForm } from "@/components/workspace/demo-form";
import { pharmacyScreens } from "@/lib/mock/screens";

function PharmacyStock() {
  return (
    <>
      <PageTitle
        eyebrow="Pharmacy workspace"
        title="Edit Stock Item"
        description="Update quantity, reorder threshold and expiry details."
      />
      <div className="grid gap-6 lg:grid-cols-[2.1fr_1fr]">
        <Panel title="Stock item">
          <p className="mb-1 text-lg font-bold">Metformin 500 mg</p>
          <p className="text-muted-foreground mb-6 text-xs">Tablet · MED-0042</p>
          <DemoForm
            submitLabel="Save changes"
            fields={[
              { name: "quantity", placeholder: "Current quantity" },
              { name: "threshold", placeholder: "Reorder threshold" },
              { name: "batch", placeholder: "Batch number" },
              { name: "expiry", placeholder: "Expiry date" },
            ]}
          />
        </Panel>
        <div className="space-y-4">
          <Panel title="Stock health">
            <DataList variant="surface" items={pharmacyScreens.stock.items} />
          </Panel>
          <Panel title="Recent stock changes">
            <DataList
              variant="surface"
              items={[
                { title: "72 → 82", subtitle: "Today 09:48" },
                { title: "82 → 96", subtitle: "16 Sep 16:20" },
                { title: "96 → 112", subtitle: "15 Sep 11:05" },
              ]}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

function PharmacyRequests() {
  return (
    <>
      <PageTitle
        eyebrow="Pharmacy workspace"
        title="Stock Requests"
        description="Confirm medicine availability or notify patients about unavailable items."
      />
      <StatCards metrics={pharmacyScreens.requests.metrics} />
      <Panel title="Patient requests">
        <DataList variant="surface" items={pharmacyScreens.requests.items} />
      </Panel>
    </>
  );
}

function PharmacyDashboard() {
  return (
    <>
      <PageTitle
        eyebrow="Pharmacy workspace"
        title="Inventory Dashboard"
        description="Monitor stock quantity, reorder thresholds and expiry risks."
      />
      <StatCards metrics={pharmacyScreens.dashboard.metrics} />
      <Panel title="Medicine inventory">
        <WorkTable
          headers={["Medicine", "Quantity", "Reorder", "Status", "Expiry", "Action"]}
          rows={[
            [
              "Amoxicillin 500 mg",
              "Qty 240",
              "Reorder 80",
              "In stock",
              "12 Mar 2027",
              "Edit",
            ],
            [
              "Metformin 500 mg",
              "Qty 72",
              "Reorder 100",
              "Low stock",
              "28 Nov 2027",
              "Edit",
            ],
            [
              "Amlodipine 5 mg",
              "Qty 180",
              "Reorder 60",
              "In stock",
              "15 Jun 2028",
              "Edit",
            ],
            ["Salbutamol inhaler", "Qty 0", "Reorder 20", "Out of stock", "—", "Edit"],
            [
              "Atorvastatin 20 mg",
              "Qty 96",
              "Reorder 40",
              "In stock",
              "09 Jan 2027",
              "Edit",
            ],
            [
              "Paracetamol 500 mg",
              "Qty 620",
              "Reorder 200",
              "In stock",
              "21 Aug 2028",
              "Edit",
            ],
          ]}
        />
      </Panel>
    </>
  );
}
export { PharmacyDashboard, PharmacyRequests, PharmacyStock };
