/**
 * Payouts screen (Phase 2 payout batches per TODO §5 / ARCHITECTURE §5):
 * TanStack Table list with status filter, detail drawer with the amount
 * breakdown and decision history, and the reason-gated actions
 * (submit / approve / mark-paid / retry). The mock enforces the §5 machine
 * (PAYOUT_TRANSITIONS) per request; mark-paid is a money op and therefore
 * non-optimistic and replay-safe via the Idempotency-Key header.
 */

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  PAYOUT_TRANSITIONS,
  VENDOR_BY_ID,
  can,
  type Payout,
  type PayoutStatus,
} from "@growbox/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Drawer } from "@/components/Drawer";
import { ReasonDialog } from "@/components/ReasonDialog";
import { StateBlock } from "@/components/StateBlock";
import { ActionGroup, type ActionGroupItem } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useAuth } from "@/auth/AuthProvider";
import { dateTime, money } from "@/lib/format";
import { adminName } from "@/lib/adminName";
import { Term } from "@/components/Term";
import {
  apiErrorMessage,
  useCalculatePayout,
  useMarkPayoutPaid,
  usePayout,
  usePayoutAction,
  usePayouts,
} from "@/api/hooks";

const STATUSES: readonly PayoutStatus[] = ["CALCULATED", "PENDING_APPROVAL", "APPROVED", "PAID", "FAILED"];

/** Human labels: the queue speaks "awaiting approval", not "PENDING_APPROVAL". */
const STATUS_LABEL: Record<PayoutStatus, string> = {
  CALCULATED: "Calculated (needs submission)",
  PENDING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved (ready to pay)",
  PAID: "Paid",
  FAILED: "Failed",
};

const STATUS_TONE: Record<PayoutStatus, "amber" | "gray" | "green" | "red" | "blue"> = {
  CALCULATED: "gray",
  PENDING_APPROVAL: "amber",
  APPROVED: "blue",
  PAID: "green",
  FAILED: "red",
};

/** The four batch ops mapped to dialog copy + destructive flag. */
const ACTIONS = [
  {
    action: "submit" as const,
    label: "Submit for approval…",
    title: "Submit payout for approval",
    description: "Moves the calculated batch into the approval queue for a second pair of eyes.",
    destructive: false,
    mutation: "decision" as const,
  },
  {
    action: "approve" as const,
    label: "Approve…",
    title: "Approve payout",
    description: "Approval locks the amounts; the batch becomes ready for the bank transfer.",
    destructive: false,
    mutation: "decision" as const,
  },
  {
    action: "mark-paid" as const,
    label: "Mark paid…",
    title: "Mark payout paid",
    description: "Money operation: records the transfer against the batch. Replay-safe via an idempotency key.",
    destructive: true,
    mutation: "money" as const,
  },
  {
    action: "retry" as const,
    label: "Retry…",
    title: "Retry failed payout",
    description: "Returns the failed batch to the approval queue after fixing the failure cause.",
    destructive: false,
    mutation: "decision" as const,
  },
];

type PayoutAction = (typeof ACTIONS)[number]["action"];

export function PayoutsRoute() {
  const { admin } = useAuth();
  const [filters, setFilters] = useState<{ status?: PayoutStatus }>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const payoutQuery = usePayout(selectedId);
  const payoutsQuery = usePayouts(filters);

  // Calculator dialog state.
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcVendor, setCalcVendor] = useState("");
  const [calcStart, setCalcStart] = useState("");
  const [calcEnd, setCalcEnd] = useState("");
  const calc = useCalculatePayout();
  const canCalculate = admin ? can(admin.role, "payouts:calculate") : false;

  const openCalcDialog = () => {
    // Default the period to the last 7 days (demo data clusters there).
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    setCalcStart(iso(weekAgo));
    setCalcEnd(iso(today));
    if (!calcVendor) setCalcVendor(VENDOR_BY_ID.keys().next().value ?? "");
    calc.reset();
    setCalcOpen(true);
  };

  const columns = useMemo<ColumnDef<Payout, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Batch",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.id.slice(-6).toUpperCase()}</span>
        ),
      },
      {
        id: "vendor",
        accessorFn: (p) => VENDOR_BY_ID.get(p.vendor_id)?.business_name ?? p.vendor_id,
        header: "Vendor",
        cell: ({ row }) => (
          <span className="font-medium">
            {VENDOR_BY_ID.get(row.original.vendor_id)?.business_name ?? row.original.vendor_id}
          </span>
        ),
      },
      {
        id: "period",
        accessorFn: (p) => p.period_start,
        header: "Period",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {row.original.period_start} to {row.original.period_end}
          </span>
        ),
      },
      {
        accessorKey: "net_cents",
        header: () => <Term k="gmv">Net payout</Term>,
        meta: { align: "right" as const },
        cell: ({ row }) => <span className="font-medium">{money(row.original.net_cents)}</span>,
      },
      {
        accessorKey: "orders_count",
        header: "Orders",
        meta: { align: "right" as const },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.orders_count}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={STATUS_LABEL[row.original.status]}
            tone={STATUS_TONE[row.original.status]}
          />
        ),
      },
      {
        accessorKey: "paid_at",
        header: "Paid",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {row.original.paid_at ? dateTime(row.original.paid_at) : "–"}
          </span>
        ),
      },
    ],
    [],
  );

  const rows = payoutsQuery.data?.data ?? [];
  // Facet counts stay accurate even when batches span more than one page.
  const pendingCount =
    payoutsQuery.data?.total_by_status?.PENDING_APPROVAL ??
    rows.filter((p) => p.status === "PENDING_APPROVAL").length;
  const failedCount =
    payoutsQuery.data?.total_by_status?.FAILED ?? rows.filter((p) => p.status === "FAILED").length;

  return (
    <div>
      <PageHeader
        title="Payouts"
        description="Vendor settlement batches: submit, approve, mark paid, and retry failures. Every decision is audited and money ops are replay-safe."
      />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={payoutsQuery.isLoading}
        error={payoutsQuery.isError ? apiErrorMessage(payoutsQuery.error) : null}
        onRetry={() => void payoutsQuery.refetch()}
        onRowClick={(p) => setSelectedId(p.id)}
        emptyTitle="No payout batches match the filter"
        emptyMessage="Batches appear here after the settlement run calculates vendor totals."
        toolbar={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              aria-label="Filter by status"
              className="rounded-md border border-input bg-card px-2 py-1.5"
              value={filters.status ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: (e.target.value || undefined) as PayoutStatus }))
              }
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            {canCalculate && (
              <Button variant="outline" onClick={openCalcDialog}>
                Calculate batch…
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {pendingCount} awaiting approval · {failedCount} failed · {rows.length} shown
            </span>
          </div>
        }
      />

      <Drawer
        open={selectedId != null}
        onClose={() => setSelectedId(null)}
        title={
          payoutQuery.data ? (
            <span className="flex items-center gap-2">
              Batch {payoutQuery.data.id.slice(-6).toUpperCase()}
              <StatusBadge
                status={STATUS_LABEL[payoutQuery.data.status]}
                tone={STATUS_TONE[payoutQuery.data.status]}
              />
            </span>
          ) : (
            "Payout"
          )
        }
        subtitle={
          payoutQuery.data
            ? `${VENDOR_BY_ID.get(payoutQuery.data.vendor_id)?.business_name ?? payoutQuery.data.vendor_id} · ${payoutQuery.data.period_start} to ${payoutQuery.data.period_end}`
            : undefined
        }
      >
        {payoutQuery.data && <PayoutDetail payout={payoutQuery.data} />}
        {payoutQuery.isError && (
          <StateBlock
            variant="error"
            title="Couldn't load this payout"
            message={apiErrorMessage(payoutQuery.error)}
            onRetry={() => void payoutQuery.refetch()}
            retrying={payoutQuery.isFetching}
          />
        )}
      </Drawer>

      <ReasonDialog
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
        title="Calculate payout batch"
        description="Sums the vendor's settleable orders in the period (cancelled and refunded sales excluded) into a new CALCULATED batch."
        submitLabel="Calculate"
        busy={calc.isPending}
        error={calc.isError ? apiErrorMessage(calc.error) : null}
        validate={() =>
          !calcVendor || !calcStart || !calcEnd
            ? "Pick a vendor and both period dates first."
            : calcStart > calcEnd
              ? "Period start must be on or before the end date."
              : null
        }
        onSubmit={({ reason }) =>
          calc.mutate(
            { vendor_id: calcVendor, period_start: calcStart, period_end: calcEnd, reason },
            {
              onSuccess: () => {
                calc.reset();
                setCalcOpen(false);
              },
            },
          )
        }
      >
        <Field label="Vendor" htmlFor="calc-vendor">
          <select
            id="calc-vendor"
            className={"w-full rounded-md border border-input bg-card px-3 py-2 text-sm"}
            value={calcVendor}
            onChange={(e) => setCalcVendor(e.target.value)}
          >
            {[...VENDOR_BY_ID.values()].map((v) => (
              <option key={v.id} value={v.id}>
                {v.business_name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Period start" htmlFor="calc-start">
            <input
              id="calc-start"
              type="date"
              className={"w-full rounded-md border border-input bg-card px-3 py-2 text-sm"}
              value={calcStart}
              onChange={(e) => setCalcStart(e.target.value)}
            />
          </Field>
          <Field label="Period end" htmlFor="calc-end">
            <input
              id="calc-end"
              type="date"
              className={"w-full rounded-md border border-input bg-card px-3 py-2 text-sm"}
              value={calcEnd}
              onChange={(e) => setCalcEnd(e.target.value)}
            />
          </Field>
        </div>
      </ReasonDialog>
    </div>
  );
}

function PayoutDetail({ payout }: { payout: Payout }) {
  const { admin } = useAuth();
  const legal = PAYOUT_TRANSITIONS[payout.status] ?? [];
  const allowed = (op: Parameters<typeof can>[1]) => (admin ? can(admin.role, op) : false);

  /** Batch ops this status + role allows (the §5 machine yields one at a time). */
  const items: ActionGroupItem<PayoutAction>[] = ACTIONS.filter((a) => {
    if (a.action === "submit")
      return allowed("payouts:submit") && payout.status === "CALCULATED" && legal.includes("PENDING_APPROVAL");
    if (a.action === "approve")
      return allowed("payouts:approve") && payout.status === "PENDING_APPROVAL" && legal.includes("APPROVED");
    if (a.action === "mark-paid")
      return allowed("payouts:mark-paid") && payout.status === "APPROVED" && legal.includes("PAID");
    return allowed("payouts:retry") && payout.status === "FAILED" && legal.includes("PENDING_APPROVAL");
  }).map((a) => ({ id: a.action, label: a.label, destructive: a.destructive }));

  return (
    <div className="space-y-6 text-sm">
      {payout.status === "FAILED" && payout.failure_reason && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive dark:text-red-300">
          Transfer failed: {payout.failure_reason}
        </p>
      )}

      <ActionGroup<PayoutAction>
        label="Payout actions"
        items={items}
        renderDialog={(action, onClose) => <PayoutActionDialog payout={payout} action={action} onClose={onClose} />}
      />

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Amounts</h3>
        <dl className="grid grid-cols-2 gap-3">
          <Detail label="Gross sales" value={money(payout.gross_cents)} />
          <Detail label="Commission" value={money(payout.commission_cents)} />
          <Detail label="Net payout" value={money(payout.net_cents)} emphasized />
          <Detail label="Orders" value={String(payout.orders_count)} />
          <Detail label="Approved" value={payout.approved_at ? dateTime(payout.approved_at) : "Not yet"} />
          <Detail label="Paid" value={payout.paid_at ? dateTime(payout.paid_at) : "Not yet"} />
        </dl>
        <p className="rounded-lg bg-muted/60 p-3 leading-relaxed text-muted-foreground">
          Net is gross minus commission. Amounts are locked at approval; later order changes roll into the
          next batch.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Decision history ({payout.decision_history.length})
        </h3>
        {payout.decision_history.length === 0 ? (
          <p className="text-muted-foreground">No decisions yet: this batch was calculated but not submitted.</p>
        ) : (
          <ol className="space-y-2">
            {payout.decision_history.map((d, i) => (
              <li key={`${d.at}-${i}`} className="rounded-lg border border-border bg-card p-3">
                <p>
                  <StatusBadge
                    className="mr-2"
                    status={d.action}
                    tone={d.action === "APPROVED" || d.action === "PAID" ? "green" : d.action === "RETRY" ? "red" : "gray"}
                  />
                  {d.reason}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {adminName(d.admin_id)} · {dateTime(d.at)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 ${emphasized ? "text-base font-semibold" : "font-medium"}`}>{value}</dd>
    </div>
  );
}

/**
 * Reason dialog for one payout action. Mounts fresh per open, so a failed
 * attempt never carries its error into the next attempt.
 */
function PayoutActionDialog({ payout, action, onClose }: { payout: Payout; action: PayoutAction; onClose: () => void }) {
  const meta = ACTIONS.find((a) => a.action === action)!;
  const decision = usePayoutAction(payout.id);
  const markPaid = useMarkPayoutPaid(payout.id);
  const mutation = meta.mutation === "money" ? markPaid : decision;

  return (
    <ReasonDialog
      open
      onClose={onClose}
        title={`${meta.title} · batch ${payout.id.slice(-6).toUpperCase()}`}
        description={meta.description}
        submitLabel={meta.title.replace(" payout", "").replace(" failed", "")}
        destructive={meta.destructive}
        busy={meta.mutation === "money" ? markPaid.isPending : decision.isPending}
        error={
          meta.mutation === "money"
            ? markPaid.isError
              ? apiErrorMessage(markPaid.error)
              : null
            : decision.isError
              ? apiErrorMessage(decision.error)
              : null
        }
        onSubmit={({ reason }) => {
          const opts = {
            onSuccess: () => {
              mutation.reset();
              onClose();
            },
          };
          // Narrowing on the action (not just the mutation kind) also narrows
          // the literal type: "mark-paid" never reaches the decision mutation.
          if (action === "mark-paid") {
            markPaid.mutate({ reason }, opts);
          } else {
            decision.mutate({ action, reason }, opts);
          }
        }}
    />
  );
}
