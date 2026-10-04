/**
 * Orders screen (Phase 1, TODO.md §4): list with column filters, detail
 * drawer (items, totals, SLA, override timeline with admin stamps, 3PL),
 * status override + logistics assignment dialogs. All mutations carry a
 * reason and hit the mocked audited endpoints.
 */

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ORDER_TRANSITIONS, can, type OrderStatus } from "@growbox/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge, ORDER_STATUS_TONE } from "@/components/StatusBadge";
import { Drawer } from "@/components/Drawer";
import { ReasonDialog } from "@/components/ReasonDialog";
import { StateBlock } from "@/components/StateBlock";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useAuth } from "@/auth/AuthProvider";
import { dateOnly, dateTime, money } from "@/lib/format";
import { adminName } from "@/lib/adminName";
import { Term } from "@/components/Term";
import {
  apiErrorMessage,
  useAssignLogistics,
  useOrder,
  useOrders,
  useOverrideOrderStatus,
  type Order,
  type OrderFilters,
} from "@/api/hooks";

const STATUSES: readonly OrderStatus[] = [
  "PLACED",
  "ACCEPTED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

export function OrdersRoute() {
  const { admin } = useAuth();
  const [filters, setFilters] = useState<OrderFilters>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [logisticsOpen, setLogisticsOpen] = useState(false);

  const ordersQuery = useOrders(filters);
  const orderQuery = useOrder(selectedId);

  const canOverride = admin ? can(admin.role, "orders:override-status") : false;
  const canAssign = admin ? can(admin.role, "orders:assign-logistics") : false;

  const columns = useMemo<ColumnDef<Order, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Order",
        cell: ({ row }) => (
          <div className="font-mono text-xs">{row.original.id.slice(-6).toUpperCase()}</div>
        ),
      },
      { accessorKey: "vendor_name", header: "Vendor" },
      {
        id: "customer",
        accessorFn: (o) => o.customer.name,
        header: "Customer",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.status} tone={ORDER_STATUS_TONE[row.original.status] ?? "gray"} />
        ),
        filterFn: (row, id, value: string[]) =>
          !value || value.length === 0 ? true : value.includes(row.getValue(id) as string),
      },
      {
        accessorFn: (o) => o.sla.breached,
        id: "sla",
        header: () => <Term k="sla">Response time</Term>,
        meta: { label: "Response time" },
        cell: ({ row }) =>
          row.original.sla.breached ? (
            <span className="font-medium text-destructive">
              overdue{row.original.sla.escalated ? " · escalated" : ""}
            </span>
          ) : (
            <span className="text-muted-foreground">on time</span>
          ),
      },
      {
        accessorKey: "totals.total_cents",
        header: "Total",
        meta: { align: "right" as const },
        cell: ({ row }) => money(row.original.totals.total_cents),
      },
      {
        accessorKey: "created_at",
        header: "Placed",
        cell: ({ row }) => <span className="text-muted-foreground">{dateOnly(row.original.created_at)}</span>,
      },
    ],
    [],
  );

  const rows = ordersQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Orders"
        description={
          <span>
            Order oversight: <Term k="override">status overrides</Term> and{" "}
            <Term k="threePl">courier</Term> assignment, fully audit-trailed.
          </span>
        }
      />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={ordersQuery.isLoading}
        error={ordersQuery.isError ? apiErrorMessage(ordersQuery.error) : null}
        onRetry={() => void ordersQuery.refetch()}
        onRowClick={(o) => setSelectedId(o.id)}
        emptyTitle="No orders match the filters"
        emptyMessage="Try widening the filters, or check back as buyers place new orders."
        toolbar={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              aria-label="Filter by status"
              className="rounded-md border border-input bg-card px-2 py-1.5"
              value={filters.status ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: (e.target.value || undefined) as OrderStatus }))
              }
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-muted-foreground">
              <input
                type="checkbox"
                checked={filters.sla === "breached"}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, sla: e.target.checked ? "breached" : undefined }))
                }
              />
              Past deadline only
            </label>
            <span className="ml-auto text-xs text-muted-foreground">
              {rows.length} order{rows.length === 1 ? "" : "s"}
            </span>
          </div>
        }
      />

      <Drawer
        open={selectedId != null}
        onClose={() => setSelectedId(null)}
        title={
          orderQuery.data ? (
            <span className="flex items-center gap-2">
              Order {orderQuery.data.id.slice(-6).toUpperCase()}
              <StatusBadge
                status={orderQuery.data.status}
                tone={ORDER_STATUS_TONE[orderQuery.data.status] ?? "gray"}
              />
            </span>
          ) : (
            "Order"
          )
        }
        subtitle={orderQuery.data ? `${orderQuery.data.vendor_name} · ${dateTime(orderQuery.data.created_at)}` : undefined}
      >
        {orderQuery.data && (
          <OrderDetail
            order={orderQuery.data}
            canOverride={canOverride}
            canAssign={canAssign}
            onOverride={() => setOverrideOpen(true)}
            onAssign={() => setLogisticsOpen(true)}
          />
        )}
        {orderQuery.isError && (
          <StateBlock
            variant="error"
            title="Couldn't load this order"
            message={apiErrorMessage(orderQuery.error)}
            onRetry={() => void orderQuery.refetch()}
            retrying={orderQuery.isFetching}
          />
        )}
      </Drawer>

      {orderQuery.data && (
        <OverrideDialog
          order={orderQuery.data}
          open={overrideOpen}
          canOverride={canOverride}
          onClose={() => setOverrideOpen(false)}
        />
      )}
      {orderQuery.data && (
        <LogisticsDialog
          order={orderQuery.data}
          open={logisticsOpen}
          canAssign={canAssign}
          onClose={() => setLogisticsOpen(false)}
        />
      )}
    </div>
  );
}

function OrderDetail({
  order,
  canOverride,
  canAssign,
  onOverride,
  onAssign,
}: {
  order: Order;
  canOverride: boolean;
  canAssign: boolean;
  onOverride: () => void;
  onAssign: () => void;
}) {
  const legal = ORDER_TRANSITIONS[order.status] ?? [];
  return (
    <div className="space-y-6 text-sm">
      <div className="flex flex-wrap gap-2">
        {canOverride && legal.length > 0 && (
          <Button variant="outline" onClick={onOverride}>
            Override status…
          </Button>
        )}
        {canAssign && <Button variant="outline" onClick={onAssign}>Assign courier…</Button>}
        {/* SLA / courier copy uses <Term> glossary tooltips — see §5 UI copy guide */}
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Customer & totals</h3>
        <div className="rounded-lg border border-border bg-card p-3">
          <p>
            <span className="text-muted-foreground">Customer:</span> {order.customer.name}
          </p>
          <p>
            <span className="text-muted-foreground">Vendor:</span> {order.vendor_name}
          </p>
          <ul className="mt-2 divide-y divide-border/60">
            {order.items.map((item) => (
              <li key={item.listing_id} className="flex justify-between py-1.5">
                <span>
                  {item.name} · {item.quantity_kg} kg @ {money(item.unit_price_cents)}
                </span>
                <span>{money(item.total_cents)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-1 border-t border-border pt-2">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery fee</dt>
              <dd>{money(order.totals.delivery_fee_cents)}</dd>
            </div>
            {order.totals.discount_cents > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount</dt>
                <dd>-{money(order.totals.discount_cents)}</dd>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <dt>Total</dt>
              <dd>{money(order.totals.total_cents)}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>Commission</dt>
              <dd>{money(order.totals.commission_amount_cents)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <Term k="sla">Response time</Term> & courier
        </h3>
        <div className="rounded-lg border border-border bg-card p-3">
          <p>
            {order.sla.breached ? (
              <span className="font-medium text-destructive">
                {order.sla.type === "UNSHIPPED" ? "Not shipped within" : "No response within"} the promised{" "}
                {order.sla.threshold_hours}-hour window
                {order.sla.breached_at ? ` · overdue since ${dateTime(order.sla.breached_at)}` : ""}
                {order.sla.escalated ? " · escalated to management" : ""}
              </span>
            ) : (
              <span className="text-muted-foreground">
                Within the promised {order.sla.threshold_hours}-hour window ({order.sla.type === "UNSHIPPED" ? "shipment" : "response"} deadline)
              </span>
            )}
          </p>
          <p className="mt-1">
            {order.assigned_logistics ? (
              <>
                <span className="text-muted-foreground">Courier:</span> {order.assigned_logistics.provider} ·{" "}
                <span className="font-mono text-xs">{order.assigned_logistics.tracking_ref}</span> ·{" "}
                {dateTime(order.assigned_logistics.at)}
              </>
            ) : (
              <span className="text-muted-foreground">No courier assigned yet.</span>
            )}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Timeline (admin overrides)</h3>
        {order.admin_overrides.length === 0 ? (
          <p className="text-muted-foreground">No manual overrides on this order.</p>
        ) : (
          <ol className="space-y-2">
            {order.admin_overrides.map((ov, i) => (
              <li key={i} className="rounded-lg border border-border bg-card p-3">
                <p className="flex items-center gap-2">
                  <StatusBadge status={ov.to} tone={ORDER_STATUS_TONE[ov.to] ?? "gray"} />
                  <span className="text-xs text-muted-foreground">
                    {ov.from} → {ov.to} · {dateTime(ov.at)} · by {adminName(ov.admin_id)}
                  </span>
                </p>
                <p className="mt-1 text-muted-foreground">{ov.reason}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function OverrideDialog({
  order,
  open,
  canOverride,
  onClose,
}: {
  order: Order;
  open: boolean;
  canOverride: boolean;
  onClose: () => void;
}) {
  const [to, setTo] = useState<OrderStatus>(order.status);
  const mutation = useOverrideOrderStatus(order.id);
  const legal = ORDER_TRANSITIONS[order.status] ?? [];
  const blocked = !canOverride || legal.length === 0;

  return (
    <ReasonDialog
      open={open && !blocked}
      onClose={onClose}
      title={`Override status · order ${order.id.slice(-6).toUpperCase()}`}
      description={`Legal hops from ${order.status}: ${legal.join(", ") || "none"}. Illegal hops are rejected by the API (409).`}
      submitLabel="Override"
      busy={mutation.isPending}
      error={mutation.isError ? apiErrorMessage(mutation.error) : null}
      onSubmit={({ reason }) =>
        mutation.mutate(
          { to, reason },
          {
            onSuccess: () => {
              mutation.reset();
              onClose();
            },
          },
        )
      }
    >
      <Field label="New status" htmlFor="override-to">
        <select
          id="override-to"
          value={to}
          onChange={(e) => setTo(e.target.value as OrderStatus)}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
        >
          {legal.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </Field>
    </ReasonDialog>
  );
}

function LogisticsDialog({
  order,
  open,
  canAssign,
  onClose,
}: {
  order: Order;
  open: boolean;
  canAssign: boolean;
  onClose: () => void;
}) {
  const [provider, setProvider] = useState(order.assigned_logistics?.provider ?? "");
  const [trackingRef, setTrackingRef] = useState(order.assigned_logistics?.tracking_ref ?? "");
  const mutation = useAssignLogistics(order.id);
  const blocked = !canAssign;

  return (
    <ReasonDialog
      open={open && !blocked}
      onClose={onClose}
      title={`Assign courier · order ${order.id.slice(-6).toUpperCase()}`}
      submitLabel="Assign"
      busy={mutation.isPending}
      error={mutation.isError ? apiErrorMessage(mutation.error) : null}
      validate={() =>
        provider.trim() && trackingRef.trim() ? null : "Provider and tracking reference are required."
      }
      onSubmit={({ reason }) =>
        mutation.mutate(
          { provider: provider.trim(), tracking_ref: trackingRef.trim(), reason },
          {
            onSuccess: () => {
              mutation.reset();
              onClose();
            },
          },
        )
      }
    >
      <Field label="Courier company" htmlFor="logistics-provider">
        <input
          id="logistics-provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          placeholder="Sendy Fresh"
        />
      </Field>
      <Field label="Tracking reference" htmlFor="logistics-ref">
        <input
          id="logistics-ref"
          value={trackingRef}
          onChange={(e) => setTrackingRef(e.target.value)}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm font-mono"
          placeholder="SND-88120-KN"
        />
      </Field>
    </ReasonDialog>
  );
}
