/**
 * Vendors screen (Phase 1, TODO.md §4): list with status/performance filters,
 * profile drawer with performance meters + warning history, and the four
 * enforcement actions (warn / suspend / reinstate / ban) — all reason-gated
 * and role-gated; the mock enforces the §5 machine per request.
 */

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { VENDOR_TRANSITIONS, can, type VendorStatus } from "@growbox/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge, VENDOR_STATUS_TONE, type Tone } from "@/components/StatusBadge";
import { Drawer } from "@/components/Drawer";
import { ReasonDialog } from "@/components/ReasonDialog";
import { StateBlock } from "@/components/StateBlock";
import { ActionGroup, type ActionGroupItem } from "@/components/ui/ActionGroup";
import { useAuth } from "@/auth/AuthProvider";
import { dateOnly, dateTime, pct } from "@/lib/format";
import { adminName } from "@/lib/adminName";
import { Term } from "@/components/Term";
import {
  apiErrorMessage,
  useVendor,
  useVendorAction,
  useVendorKycReview,
  useVendors,
  type KycAction,
  type Vendor,
  type VendorFilters,
} from "@/api/hooks";

const STATUSES: readonly VendorStatus[] = ["PENDING_KYC", "KYC_REVIEW", "APPROVED", "SUSPENDED", "BANNED"];

/** Human labels for the vendor lifecycle (KYC spelled out per UI copy guide). */
const STATUS_LABEL: Record<VendorStatus, string> = {
  PENDING_KYC: "Awaiting identity check",
  KYC_REVIEW: "Identity check in review",
  APPROVED: "Approved",
  SUSPENDED: "Suspended",
  BANNED: "Banned",
};

/** Column header with the KYC glossary tooltip attached. */
function StatusHeader() {
  return <Term k="kyc">Identity check (KYC)</Term>;
}

/** The four vendor ops mapped to dialog copy + destructive flag. */
const ACTIONS = [
  { action: "warn", label: "Warn…", title: "Issue warning", destructive: false },
  { action: "suspend", label: "Suspend…", title: "Suspend vendor", destructive: true },
  { action: "reinstate", label: "Reinstate…", title: "Reinstate vendor", destructive: false },
  { action: "ban", label: "Ban…", title: "Ban vendor", destructive: true },
] as const;

type ActionName = (typeof ACTIONS)[number]["action"];

export function VendorsRoute() {
  const [filters, setFilters] = useState<VendorFilters>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const vendorQuery = useVendor(selectedId);
  const vendorsQuery = useVendors(filters);

  const columns = useMemo<ColumnDef<Vendor, unknown>[]>(
    () => [
      {
        accessorKey: "business_name",
        header: "Business",
        cell: ({ row }) => <span className="font-medium">{row.original.business_name}</span>,
      },
      {
        accessorKey: "status",
        header: () => <StatusHeader />,
        cell: ({ row }) => (
          <StatusBadge
            status={STATUS_LABEL[row.original.status]}
            tone={VENDOR_STATUS_TONE[row.original.status] ?? "gray"}
          />
        ),
      },
      {
        accessorFn: (v) => v.performance.cancellation_rate,
        id: "cancellation",
        header: "Cancellations",
        meta: { align: "right" as const },
        cell: ({ row }) => pct(row.original.performance.cancellation_rate),
      },
      {
        accessorFn: (v) => v.performance.late_shipment_rate,
        id: "late",
        header: "Late shipments",
        meta: { align: "right" as const },
        cell: ({ row }) => pct(row.original.performance.late_shipment_rate),
      },
      {
        accessorFn: (v) => v.performance.spoilage_complaints,
        id: "spoilage",
        header: "Spoilage",
        meta: { align: "right" as const },
        cell: ({ row }) => String(row.original.performance.spoilage_complaints),
      },
      {
        accessorFn: (v) => v.performance.rating,
        id: "rating",
        header: "Rating",
        meta: { align: "right" as const },
        cell: ({ row }) =>
          row.original.performance.rating > 0 ? row.original.performance.rating.toFixed(1) : "–",
      },
      {
        accessorKey: "created_at",
        header: "Joined",
        cell: ({ row }) => <span className="text-muted-foreground">{dateOnly(row.original.created_at)}</span>,
      },
    ],
    [],
  );

  const rows = vendorsQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Supply side: performance monitoring and warn / suspend / reinstate / ban actions."
      />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={vendorsQuery.isLoading}
        error={vendorsQuery.isError ? apiErrorMessage(vendorsQuery.error) : null}
        onRetry={() => void vendorsQuery.refetch()}
        onRowClick={(v) => setSelectedId(v.id)}
        emptyTitle="No vendors match the filters"
        emptyMessage="Try widening the status or performance filter."
        toolbar={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              aria-label="Filter by status"
              className="rounded-md border border-input bg-card px-2 py-1.5"
              value={filters.status ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: (e.target.value || undefined) as VendorStatus }))
              }
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-muted-foreground">
              <input
                type="checkbox"
                checked={filters.performance === "poor"}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, performance: e.target.checked ? "poor" : undefined }))
                }
              />
              Poor performers only
            </label>
            <span className="ml-auto text-xs text-muted-foreground">
              {rows.length} vendor{rows.length === 1 ? "" : "s"}
            </span>
          </div>
        }
      />

      <Drawer
        open={selectedId != null}
        onClose={() => setSelectedId(null)}
        title={
          vendorQuery.data ? (
            <span className="flex items-center gap-2">
              {vendorQuery.data.business_name}
              <StatusBadge
                status={STATUS_LABEL[vendorQuery.data.status]}
                tone={VENDOR_STATUS_TONE[vendorQuery.data.status] ?? "gray"}
              />
            </span>
          ) : (
            "Vendor"
          )
        }
        subtitle={
          vendorQuery.data
            ? `${vendorQuery.data.owner.name} · ${vendorQuery.data.owner.email} · joined ${dateOnly(vendorQuery.data.created_at)}`
            : undefined
        }
      >
        {vendorQuery.data && <VendorDetail vendor={vendorQuery.data} />}
        {vendorQuery.isError && (
          <StateBlock
            variant="error"
            title="Couldn't load this vendor"
            message={apiErrorMessage(vendorQuery.error)}
            onRetry={() => void vendorQuery.refetch()}
            retrying={vendorQuery.isFetching}
          />
        )}
      </Drawer>
    </div>
  );
}

function VendorDetail({ vendor }: { vendor: Vendor }) {
  const { admin } = useAuth();
  const legal = VENDOR_TRANSITIONS[vendor.status] ?? [];

  const allowed = (op: Parameters<typeof can>[1]) => (admin ? can(admin.role, op) : false);

  /** Enforcement actions this status + role allows, in row order. */
  const items: ActionGroupItem<ActionName>[] = ACTIONS.filter((a) => {
    if (a.action === "warn") return allowed("vendors:warn");
    if (a.action === "suspend") return allowed("vendors:suspend") && legal.includes("SUSPENDED");
    if (a.action === "reinstate")
      return allowed("vendors:reinstate") && legal.includes("APPROVED") && vendor.status !== "APPROVED";
    return allowed("vendors:ban") && legal.includes("BANNED");
  }).map((a) => ({ id: a.action, label: a.label, destructive: a.destructive }));

  return (
    <div className="space-y-6 text-sm">
      <ActionGroup<ActionName>
        label="Vendor actions"
        items={items}
        renderDialog={(action, onClose) => <VendorActionDialog vendor={vendor} action={action} onClose={onClose} />}
      />

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Performance meters</h3>
        <div className="grid grid-cols-2 gap-3">
          <Meter label="Cancellation rate" value={pct(vendor.performance.cancellation_rate)} bad={vendor.performance.cancellation_rate >= 0.1} />
          <Meter label="Late shipments" value={pct(vendor.performance.late_shipment_rate)} bad={vendor.performance.late_shipment_rate >= 0.15} />
          <Meter label="Spoilage complaints" value={String(vendor.performance.spoilage_complaints)} bad={vendor.performance.spoilage_complaints >= 20} />
          <Meter
            label="Rating"
            value={vendor.performance.rating > 0 ? `${vendor.performance.rating.toFixed(1)} / 5` : "no orders yet"}
            bad={vendor.performance.rating > 0 && vendor.performance.rating < 3}
          />
        </div>
      </section>

      <KycSection vendor={vendor} />

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Warning history ({vendor.warning_history.length})
        </h3>
        {vendor.warning_history.length === 0 ? (
          <p className="text-muted-foreground">No warnings issued.</p>
        ) : (
          <ol className="space-y-2">
            {vendor.warning_history.map((w) => (
              <li key={w.id} className="rounded-lg border border-border bg-card p-3">
                <p>{w.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {adminName(w.admin_id)} · {dateTime(w.at)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

const DOC_LABEL: Record<string, string> = {
  FARM_REGISTRATION: "Farm registration",
  LAND_DEED: "Land deed",
  ORGANIC_CERT: "Organic certification",
  BANK_DETAILS: "Bank details",
};

const DOC_TONE: Record<string, Tone> = { PENDING: "amber", VERIFIED: "green", REJECTED: "red" };

/** Which KYC actions this status allows, mirroring the mock's gate. */
const KYC_ACTIONS: Record<KycAction, { label: string; verb: string; destructive: boolean }> = {
  open: { label: "Start identity check…", verb: "Start identity check", destructive: false },
  verify: { label: "Verify…", verb: "Verify", destructive: false },
  reject: { label: "Reject documents…", verb: "Reject", destructive: true },
};

function legalKycActions(status: VendorStatus): KycAction[] {
  if (status === "PENDING_KYC") return ["open"];
  if (status === "KYC_REVIEW") return ["verify", "reject"];
  return [];
}

/**
 * KYC review workspace: document viewer (inline SVG data-URI fixtures) plus
 * the reason-gated open / verify / reject actions. A rejected document makes
 * no status hop — the vendor stays in KYC_REVIEW to resubmit.
 */
function KycSection({ vendor }: { vendor: Vendor }) {
  const { admin } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);

  const docs = vendor.kyc_documents;
  const active = docs.find((d) => d.id === selected) ?? docs[0] ?? null;
  const allowed = (op: Parameters<typeof can>[1]) => (admin ? can(admin.role, op) : false);
  const actions = legalKycActions(vendor.status).filter(() => allowed("vendors:kyc-review"));

  if (docs.length === 0) {
    return (
      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Identity documents</h3>
        <p className="text-muted-foreground">No documents submitted yet.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Identity documents ({docs.length})
        </h3>
        <ActionGroup<KycAction>
          label="Identity review actions"
          items={actions.map((a) => ({ id: a, label: KYC_ACTIONS[a].label, destructive: KYC_ACTIONS[a].destructive }))}
          renderDialog={(action, onClose) => <KycDialog vendor={vendor} action={action} onClose={onClose} />}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        {/* Viewer: renders the fixture itself, not a description of it. */}
        <figure className="overflow-hidden rounded-lg border border-border bg-card">
          {active ? (
            <img
              src={active.file_url}
              alt={`${DOC_LABEL[active.type] ?? active.type} for ${vendor.business_name}`}
              className="block w-full"
            />
          ) : null}
        </figure>

        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setSelected(d.id)}
                aria-current={active?.id === d.id}
                className={`w-full rounded-lg border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  active?.id === d.id ? "border-ring bg-accent" : "border-border bg-card hover:border-ring/50"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{DOC_LABEL[d.type] ?? d.type}</span>
                  <StatusBadge status={d.status} tone={DOC_TONE[d.status] ?? "gray"} />
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {d.status === "PENDING" ? `Uploaded ${dateOnly(d.uploaded_at)}` : `Reviewed ${dateOnly(d.reviewed_at ?? d.uploaded_at)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {active?.notes ? (
        <div className="rounded-lg border border-border bg-card p-3 text-sm">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Reviewer notes</p>
          <p className="mt-1">{active.notes}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {adminName(active.reviewed_by_admin_id ?? "")} · {dateTime(active.reviewed_at ?? active.uploaded_at)}
          </p>
        </div>
      ) : null}

    </section>
  );
}

/** The reason + notes dialog for one KYC action. */
function KycDialog({ vendor, action, onClose }: { vendor: Vendor; action: KycAction; onClose: () => void }) {
  const meta = KYC_ACTIONS[action];
  const mutation = useVendorKycReview(vendor.id);
  const [notes, setNotes] = useState("");

  const docsToStamp =
    action === "verify"
      ? vendor.kyc_documents.filter((d) => d.status !== "VERIFIED").length
      : vendor.kyc_documents.filter((d) => d.status === "PENDING").length;

  return (
    <ReasonDialog
      open
      onClose={onClose}
      title={`${meta.verb} · ${vendor.business_name}`}
      description={
        action === "reject"
          ? "Rejected documents do not change the vendor's status: it stays in review until it resubmits."
          : action === "verify"
            ? `Stamps ${docsToStamp} outstanding document${docsToStamp === 1 ? "" : "s"} verified and approves the vendor.`
            : "Moves the vendor into identity review so documents can be checked."
      }
      submitLabel={meta.verb}
      destructive={meta.destructive}
      busy={mutation.isPending}
      error={mutation.isError ? apiErrorMessage(mutation.error) : null}
      onSubmit={({ reason }) =>
        mutation.mutate(
          { action, reason, notes: notes.trim() || undefined },
          {
            onSuccess: () => {
              mutation.reset();
              onClose();
            },
          },
        )
      }
    >
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Notes (optional, stamped on the documents)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="What did you check? What needs fixing?"
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        />
      </label>
    </ReasonDialog>
  );
}

function Meter({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${bad ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-semibold ${bad ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

/**
 * Reason dialog for one vendor action. Mounts fresh per open, so each action
 * starts with a clean mutation (no stale error from a previous attempt).
 */
function VendorActionDialog({ vendor, action, onClose }: { vendor: Vendor; action: ActionName; onClose: () => void }) {
  const meta = ACTIONS.find((a) => a.action === action)!;
  const mutation = useVendorAction(vendor.id);

  return (
    <ReasonDialog
      open
      onClose={onClose}
      title={`${meta.title} · ${vendor.business_name}`}
      description={
        meta.destructive
          ? "This changes the vendor's standing immediately. The transition must follow the §5 state machine."
          : undefined
      }
      submitLabel={meta.title.replace(" vendor", "")}
      destructive={meta.destructive}
      busy={mutation.isPending}
      error={mutation.isError ? apiErrorMessage(mutation.error) : null}
      onSubmit={({ reason }) =>
        mutation.mutate(
          { action, reason },
          {
            onSuccess: () => {
              mutation.reset();
              onClose();
            },
          },
        )
      }
    />
  );
}
