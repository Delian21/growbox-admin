/**
 * Marketing screen (Phase 3, TODO §6): discount codes across their lifecycle
 * (DRAFT → SCHEDULED → LIVE → ENDED) and the broadcast composer. Same
 * DataTable + reason-dialog pattern as the rest of the admin — every decision
 * is reason-gated and the mock enforces PROMO_TRANSITIONS per request.
 */

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { PROMO_TRANSITIONS, can } from "@growbox/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Drawer } from "@/components/Drawer";
import { ReasonDialog } from "@/components/ReasonDialog";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/auth/AuthProvider";
import { dateOnly, dateTime, money } from "@/lib/format";
import { adminName } from "@/lib/adminName";
import {
  apiErrorMessage,
  useCreateNotification,
  useCreatePromotion,
  useNotifications,
  usePromotionAction,
  usePromotions,
  useSendNotification,
  type Notification,
  type NotificationAudience,
  type PromoAction,
  type Promotion,
  type PromotionFilters,
  type PromotionStatus,
} from "@/api/hooks";

const STATUSES: readonly PromotionStatus[] = ["LIVE", "SCHEDULED", "DRAFT", "ENDED"];

const STATUS_LABEL: Record<PromotionStatus, string> = {
  LIVE: "Live",
  SCHEDULED: "Scheduled",
  DRAFT: "Draft",
  ENDED: "Ended",
};

const STATUS_TONE: Record<PromotionStatus, "green" | "blue" | "gray" | "amber"> = {
  LIVE: "green",
  SCHEDULED: "blue",
  DRAFT: "gray",
  ENDED: "amber",
};

const TYPE_LABEL: Record<Promotion["type"], string> = {
  PERCENT: "Percent off",
  FIXED: "Fixed amount off",
  FREE_SHIPPING: "Free shipping",
};

const SCOPE_LABEL: Record<Promotion["scope"], string> = {
  GLOBAL: "All products",
  CATEGORY: "One category",
  VENDOR: "One vendor",
};

/** Human rendering of the discount value for each promotion type. */
function promoValue(p: Promotion): string {
  if (p.type === "PERCENT") return `${p.value}% off`;
  if (p.type === "FIXED") return `${money(p.value)} off`;
  return "Free shipping";
}

const PROMO_ACTIONS: Record<PromoAction, { label: string; destructive: boolean }> = {
  schedule: { label: "Schedule…", destructive: false },
  end: { label: "End early…", destructive: true },
};

export function MarketingRoute() {
  const [filters, setFilters] = useState<PromotionFilters>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [composing, setComposing] = useState(false);

  const promotionsQuery = usePromotions(filters);
  const rows = promotionsQuery.data?.data ?? [];
  const pendingCount = promotionsQuery.data?.total_by_status?.SCHEDULED ?? rows.filter((p) => p.status === "SCHEDULED").length;

  const columns = useMemo<ColumnDef<Promotion, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => <span className="font-medium">{row.original.code}</span>,
      },
      {
        accessorKey: "type",
        header: "Discount",
        cell: ({ row }) => <span>{promoValue(row.original)}</span>,
      },
      {
        accessorKey: "scope",
        header: "Scope",
        cell: ({ row }) => <span className="text-muted-foreground">{SCOPE_LABEL[row.original.scope]}</span>,
      },
      {
        accessorKey: "starts_at",
        header: "Window",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {dateOnly(row.original.starts_at)} – {dateOnly(row.original.ends_at)}
          </span>
        ),
      },
      {
        accessorKey: "used_count",
        header: "Used",
        meta: { align: "right" as const },
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.used_count} / {row.original.usage_limit}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge status={STATUS_LABEL[row.original.status]} tone={STATUS_TONE[row.original.status]} />
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Marketing"
        description="Discount codes and customer broadcasts. Codes move through draft, schedule, live, and end; every change is audited with a reason."
      />

      <div className="flex flex-wrap gap-2">
        <CreatePromotionButton open={creating} onOpenChange={setCreating} />
        <ComposeButton open={composing} onOpenChange={setComposing} />
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          data={rows}
          isLoading={promotionsQuery.isLoading}
          error={promotionsQuery.isError ? apiErrorMessage(promotionsQuery.error) : null}
          onRetry={() => void promotionsQuery.refetch()}
          onRowClick={(p) => setSelectedId(p.id)}
          emptyTitle="No promotions match the filter"
          emptyMessage="Try a different status, or create a discount code to get started."
          toolbar={
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select
                aria-label="Filter by status"
                className="rounded-md border border-input bg-card px-2 py-1.5"
                value={filters.status ?? ""}
                onChange={(e) => setFilters({ status: (e.target.value || undefined) as PromotionStatus })}
              >
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground">
                {pendingCount} scheduled · {rows.length} shown
              </span>
            </div>
          }
        />
      </div>

      <PromotionDrawer
        promotion={rows.find((p) => p.id === selectedId) ?? null}
        onClose={() => setSelectedId(null)}
      />

      <BroadcastHistory />
    </div>
  );
}

function PromotionDrawer({ promotion, onClose }: { promotion: Promotion | null; onClose: () => void }) {
  const { admin } = useAuth();
  const [dialog, setDialog] = useState<PromoAction | null>(null);
  const canAct = (op: Parameters<typeof can>[1]) => (admin ? can(admin.role, op) : false);

  if (!promotion) return null;
  const legal = PROMO_TRANSITIONS[promotion.status] ?? [];

  const actions: PromoAction[] = [
    ...(legal.includes("SCHEDULED") && canAct("promotions:schedule") ? (["schedule"] as const) : []),
    ...(legal.includes("ENDED") && canAct("promotions:end") ? (["end"] as const) : []),
  ];

  return (
    <>
      <Drawer open onClose={onClose} title={promotion.code}>
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={STATUS_LABEL[promotion.status]} tone={STATUS_TONE[promotion.status]} />
            <span className="text-muted-foreground">{promoValue(promotion)}</span>
          </div>

          {actions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <Button
                  key={a}
                  variant={PROMO_ACTIONS[a].destructive ? "destructive" : "outline"}
                  onClick={() => setDialog(a)}
                >
                  {PROMO_ACTIONS[a].label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              {promotion.status === "ENDED"
                ? "This campaign has ended; there is nothing left to do with it."
                : `No action is legal from ${STATUS_LABEL[promotion.status].toLowerCase()}.`}
            </p>
          )}

          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Details</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Type</dt>
              <dd>{TYPE_LABEL[promotion.type]}</dd>
              <dt className="text-muted-foreground">Scope</dt>
              <dd>
                {SCOPE_LABEL[promotion.scope]}
                {promotion.scope_ref ? ` (${promotion.scope_ref})` : ""}
              </dd>
              <dt className="text-muted-foreground">Window</dt>
              <dd>
                {dateOnly(promotion.starts_at)} – {dateOnly(promotion.ends_at)}
              </dd>
              <dt className="text-muted-foreground">Usage</dt>
              <dd>
                {promotion.used_count} of {promotion.usage_limit}
              </dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{dateTime(promotion.created_at)}</dd>
              <dt className="text-muted-foreground">Created by</dt>
              <dd>{adminName(promotion.created_by_admin_id)}</dd>
            </dl>
          </section>
        </div>
      </Drawer>

      {dialog ? (
        <PromotionActionDialog
          promotion={promotion}
          action={dialog}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}

function PromotionActionDialog({
  promotion,
  action,
  onClose,
}: {
  promotion: Promotion;
  action: PromoAction;
  onClose: () => void;
}) {
  const mutation = usePromotionAction(promotion.id);
  const meta = PROMO_ACTIONS[action];

  return (
    <ReasonDialog
      open
      onClose={onClose}
      title={`${action === "schedule" ? "Schedule" : "End"} ${promotion.code}`}
      description={
        action === "schedule"
          ? "The code becomes visible to customers when the window opens."
          : "Ending is immediate and irreversible: the code stops working at once."
      }
      submitLabel={action === "schedule" ? "Schedule" : "End campaign"}
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

function CreatePromotionButton({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { admin } = useAuth();
  if (!admin || !can(admin.role, "promotions:create")) return null;

  return (
    <>
      <Button onClick={() => onOpenChange(true)}>New discount code…</Button>
      {open ? <CreatePromotionDialog onClose={() => onOpenChange(false)} /> : null}
    </>
  );
}

function CreatePromotionDialog({ onClose }: { onClose: () => void }) {
  const mutation = useCreatePromotion();
  const [form, setForm] = useState({
    code: "",
    type: "PERCENT" as Promotion["type"],
    value: "10",
    scope: "GLOBAL" as Promotion["scope"],
    scope_ref: "",
    starts_at: "",
    ends_at: "",
    usage_limit: "1000",
  });
  const [reason, setReason] = useState("");

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const numericValue = Number(form.value);
  const numericLimit = Number(form.usage_limit);
  const mismatch =
    form.type === "PERCENT" && (numericValue < 1 || numericValue > 100)
      ? "Percent must be 1 to 100."
      : form.type === "FIXED" && numericValue <= 0
        ? "Fixed discount needs an amount above zero."
        : form.scope !== "GLOBAL" && !form.scope_ref.trim()
          ? "Pick a category or vendor for this scope."
          : form.starts_at && form.ends_at && form.starts_at >= form.ends_at
            ? "The end of the window must be after its start."
            : null;

  return (
    <ReasonDialog
      open
      onClose={onClose}
      title="New discount code"
      description="Codes start as drafts. Schedule one once its window is set."
      submitLabel="Create draft"
      busy={mutation.isPending}
      error={mutation.isError ? apiErrorMessage(mutation.error) : null}
      validate={() => mismatch}
      onSubmit={() =>
        mutation.mutate(
          {
            code: form.code.trim().toUpperCase(),
            type: form.type,
            value: form.type === "FREE_SHIPPING" ? 0 : numericValue,
            scope: form.scope,
            scope_ref: form.scope.trim() || undefined,
            starts_at: new Date(form.starts_at).toISOString(),
            ends_at: new Date(form.ends_at).toISOString(),
            usage_limit: numericLimit,
            reason: reason.trim(),
          },
          {
            onSuccess: () => {
              mutation.reset();
              onClose();
            },
          },
        )
      }
    >
      <div className="space-y-3 text-sm">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Code</span>
          <input
            value={form.code}
            onChange={set("code")}
            maxLength={24}
            placeholder="HARVEST20"
            className="w-full rounded-md border border-input bg-card px-3 py-2 uppercase outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Type</span>
            <select
              value={form.type}
              onChange={set("type")}
              className="w-full rounded-md border border-input bg-card px-3 py-2 outline-none"
            >
              <option value="PERCENT">Percent off</option>
              <option value="FIXED">Fixed amount off</option>
              <option value="FREE_SHIPPING">Free shipping</option>
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {form.type === "PERCENT" ? "Percent" : form.type === "FIXED" ? "Amount (kobo)" : "Value"}
            </span>
            <input
              value={form.type === "FREE_SHIPPING" ? "0" : form.value}
              onChange={set("value")}
              disabled={form.type === "FREE_SHIPPING"}
              inputMode="numeric"
              className="w-full rounded-md border border-input bg-card px-3 py-2 outline-none disabled:opacity-50"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Scope</span>
            <select value={form.scope} onChange={set("scope")} className="w-full rounded-md border border-input bg-card px-3 py-2 outline-none">
              <option value="GLOBAL">All products</option>
              <option value="CATEGORY">One category</option>
              <option value="VENDOR">One vendor</option>
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {form.scope === "CATEGORY" ? "Category" : form.scope === "VENDOR" ? "Vendor ID" : "Scope reference"}
            </span>
            <input
              value={form.scope_ref}
              onChange={set("scope_ref")}
              disabled={form.scope === "GLOBAL"}
              placeholder={form.scope === "GLOBAL" ? "not needed" : form.scope === "CATEGORY" ? "leafy-greens" : "ven_..."}
              className="w-full rounded-md border border-input bg-card px-3 py-2 outline-none disabled:opacity-50"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Starts</span>
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={set("starts_at")}
              className="w-full rounded-md border border-input bg-card px-3 py-2 outline-none"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Ends</span>
            <input
              type="datetime-local"
              value={form.ends_at}
              onChange={set("ends_at")}
              className="w-full rounded-md border border-input bg-card px-3 py-2 outline-none"
            />
          </label>
        </div>

        <details className="rounded-lg border border-border">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            Advanced options · usage limit {form.usage_limit} uses
          </summary>
          <div className="border-t border-border px-3 py-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Usage limit</span>
              <input
                value={form.usage_limit}
                onChange={set("usage_limit")}
                inputMode="numeric"
                className="w-full rounded-md border border-input bg-card px-3 py-2 outline-none"
              />
            </label>
          </div>
        </details>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Reason (why this campaign exists)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-input bg-card px-3 py-2 outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          />
        </label>

        {mismatch ? <p className="text-xs text-destructive">{mismatch}</p> : null}
      </div>
    </ReasonDialog>
  );
}

function ComposeButton({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { admin } = useAuth();
  if (!admin || !can(admin.role, "notifications:create")) return null;

  return (
    <>
      <Button variant="outline" onClick={() => onOpenChange(true)}>
        Compose broadcast…
      </Button>
      {open ? <ComposeDialog onClose={() => onOpenChange(false)} /> : null}
    </>
  );
}

function ComposeDialog({ onClose }: { onClose: () => void }) {
  const mutation = useCreateNotification();
  const [audience, setAudience] = useState<NotificationAudience>("BUYERS");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [reason, setReason] = useState("");

  const mismatch =
    !title.trim() || title.length > 120
      ? "Give the broadcast a title of 1 to 120 characters."
      : !body.trim() || body.length > 2000
        ? "The message body must be 1 to 2000 characters."
        : null;

  return (
    <ReasonDialog
      open
      onClose={onClose}
      title="Compose broadcast"
      description="Drafts wait for review; set a schedule to queue it. Sending is a separate, audited step."
      submitLabel="Save broadcast"
      busy={mutation.isPending}
      error={mutation.isError ? apiErrorMessage(mutation.error) : null}
      validate={() => mismatch}
      onSubmit={() =>
        mutation.mutate(
          {
            audience,
            title: title.trim(),
            body: body.trim(),
            scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
            reason: reason.trim(),
          },
          {
            onSuccess: () => {
              mutation.reset();
              onClose();
            },
          },
        )
      }
    >
      <div className="space-y-3 text-sm">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Audience</span>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as NotificationAudience)}
            className="w-full rounded-md border border-input bg-card px-3 py-2 outline-none"
          >
            <option value="BUYERS">Buyers</option>
            <option value="VENDORS">Vendors</option>
            <option value="SEGMENT">Custom segment</option>
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="w-full rounded-md border border-input bg-card px-3 py-2 outline-none"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={2000}
            className="w-full rounded-md border border-input bg-card px-3 py-2 outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          />
        </label>

        <details className="rounded-lg border border-border">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            Advanced options · {scheduledAt ? `scheduled for ${new Date(scheduledAt).toLocaleString()}` : "no schedule — saves as draft"}
          </summary>
          <div className="border-t border-border px-3 py-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Schedule</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-md border border-input bg-card px-3 py-2 outline-none"
              />
            </label>
          </div>
        </details>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Reason</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-input bg-card px-3 py-2 outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          />
        </label>

        {mismatch ? <p className="text-xs text-destructive">{mismatch}</p> : null}
      </div>
    </ReasonDialog>
  );
}

/** Broadcast history sits below the promotions table on the same screen. */
export function BroadcastHistory() {
  const { admin } = useAuth();
  const [audience, setAudience] = useState<NotificationAudience | undefined>(undefined);
  const query = useNotifications({ audience });
  const rows = query.data?.data ?? [];

  const columns = useMemo<ColumnDef<Notification, unknown>[]>(
    () => [
      { accessorKey: "title", header: "Title", cell: ({ row }) => <span className="font-medium">{row.original.title}</span> },
      { accessorKey: "audience", header: "Audience", cell: ({ row }) => <span className="text-muted-foreground">{row.original.audience}</span> },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            tone={row.original.status === "SENT" ? "green" : row.original.status === "SCHEDULED" ? "blue" : "gray"}
          />
        ),
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => <span className="text-muted-foreground">{dateTime(row.original.created_at)}</span>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          row.original.status === "SENT" ? (
            <span className="text-xs text-muted-foreground">sent</span>
          ) : (
            <SendButton notificationId={row.original.id} />
          ),
      },
    ],
    [],
  );

  if (!admin || !can(admin.role, "notifications:read")) return null;

  return (
    <section className="mt-8 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Broadcasts</h2>
        <select
          aria-label="Filter broadcasts by audience"
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
          value={audience ?? ""}
          onChange={(e) => setAudience((e.target.value || undefined) as NotificationAudience | undefined)}
        >
          <option value="">All audiences</option>
          <option value="BUYERS">Buyers</option>
          <option value="VENDORS">Vendors</option>
          <option value="SEGMENT">Custom segment</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={query.isLoading}
        error={query.isError ? apiErrorMessage(query.error) : null}
        onRetry={() => void query.refetch()}
        emptyTitle="No broadcasts yet"
        emptyMessage="Compose one above to get a message in front of buyers or vendors."
      />
    </section>
  );
}

function SendButton({ notificationId }: { notificationId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Send now…
      </Button>
      {open ? <SendDialog notificationId={notificationId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SendDialog({ notificationId, onClose }: { notificationId: string; onClose: () => void }) {
  const mutation = useSendNotification(notificationId);
  return (
    <ReasonDialog
      open
      onClose={onClose}
      title="Send broadcast now"
      description="This delivers immediately to the selected audience and cannot be recalled."
      submitLabel="Send"
      busy={mutation.isPending}
      error={mutation.isError ? apiErrorMessage(mutation.error) : null}
      onSubmit={({ reason }) =>
        mutation.mutate(
          { reason },
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
