/**
 * Disputes screen (Phase 1, TODO.md §4): list + detail thread, start-review,
 * resolve dialog (REFUND / WALLET_CREDIT / PARTIAL with amount cap), and
 * comments. Resolve is a money op — idempotency key added by the hook and
 * the money label marks it as demo theater (Gap Analysis §3).
 */

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DISPUTE_TRANSITIONS, can } from "@growbox/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge, DISPUTE_STATUS_TONE } from "@/components/StatusBadge";
import { Drawer } from "@/components/Drawer";
import { ReasonDialog } from "@/components/ReasonDialog";
import { StateBlock, InlineError } from "@/components/StateBlock";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useAuth } from "@/auth/AuthProvider";
import { Term } from "@/components/Term";
import { dateTime, money } from "@/lib/format";
import { adminName } from "@/lib/adminName";
import {
  apiErrorMessage,
  useAddDisputeComment,
  useDispute,
  useDisputes,
  useResolveDispute,
  useStartDisputeReview,
  type Dispute,
  type DisputeFilters,
  type DisputeCategory,
  type DisputeStatus,
} from "@/api/hooks";

const STATUSES: readonly DisputeStatus[] = [
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED_REFUND",
  "RESOLVED_CREDIT",
  "RESOLVED_PARTIAL_RECON",
  "REJECTED",
  "CLOSED",
];

const CATEGORIES: readonly DisputeCategory[] = [
  "SPOILAGE",
  "DAMAGE",
  "WRONG_ITEM",
  "NOT_DELIVERED",
  "OTHER",
];

const CATEGORY_LABEL: Record<DisputeCategory, string> = {
  SPOILAGE: "Spoilage",
  DAMAGE: "Damage",
  WRONG_ITEM: "Wrong item",
  NOT_DELIVERED: "Not delivered",
  OTHER: "Other",
};

export function DisputesRoute() {
  const { admin } = useAuth();
  const [filters, setFilters] = useState<DisputeFilters>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);

  const disputesQuery = useDisputes(filters);
  const disputeQuery = useDispute(selectedId);

  const canReview = admin ? can(admin.role, "disputes:start-review") : false;
  const canResolve = admin ? can(admin.role, "disputes:resolve") : false;
  const canComment = admin ? can(admin.role, "disputes:comment") : false;

  const columns = useMemo<ColumnDef<Dispute, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Dispute",
        cell: ({ row }) => <div className="font-mono text-xs">{row.original.id.slice(-4).toUpperCase()}</div>,
      },
      {
        accessorKey: "order_id",
        header: "Order",
        cell: ({ row }) => <div className="font-mono text-xs">{row.original.order_id.slice(-6).toUpperCase()}</div>,
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => CATEGORY_LABEL[row.original.category],
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            tone={DISPUTE_STATUS_TONE[row.original.status] ?? "gray"}
          />
        ),
      },
      {
        accessorKey: "amount_disputed_cents",
        header: "Disputed",
        meta: { align: "right" as const },
        cell: ({ row }) => money(row.original.amount_disputed_cents),
      },
      {
        accessorFn: (d) => d.sla?.breached ?? false,
        id: "sla",
        header: () => <Term k="sla">Response time</Term>,
        cell: ({ row }) =>
          row.original.sla?.breached ? (
            <span className="font-medium text-destructive">
              overdue{row.original.sla.escalated ? " · escalated" : ""}
            </span>
          ) : (
            <span className="text-muted-foreground">on time</span>
          ),
      },
      {
        accessorKey: "opened_at",
        header: "Opened",
        cell: ({ row }) => <span className="text-muted-foreground">{dateTime(row.original.opened_at)}</span>,
      },
    ],
    [],
  );

  const rows = disputesQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Disputes"
        description={
          <span>
            Mediation queue: review, resolve (refund / <Term k="walletCredit">wallet credit</Term> /{" "}
            <Term k="partialReconciliation">partial</Term>), and comment.
          </span>
        }
      />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={disputesQuery.isLoading}
        error={disputesQuery.isError ? apiErrorMessage(disputesQuery.error) : null}
        onRetry={() => void disputesQuery.refetch()}
        onRowClick={(d) => setSelectedId(d.id)}
        emptyTitle="No disputes match the filters"
        emptyMessage="An empty queue is good news: nothing is waiting on a resolution right now."
        toolbar={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              aria-label="Filter by status"
              className="rounded-md border border-input bg-card px-2 py-1.5"
              value={filters.status ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: (e.target.value || undefined) as DisputeStatus }))
              }
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by category"
              className="rounded-md border border-input bg-card px-2 py-1.5"
              value={filters.category ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, category: (e.target.value || undefined) as DisputeCategory }))
              }
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <span className="ml-auto text-xs text-muted-foreground">
              {rows.length} dispute{rows.length === 1 ? "" : "s"}
            </span>
          </div>
        }
      />

      <Drawer
        open={selectedId != null}
        onClose={() => setSelectedId(null)}
        title={
          disputeQuery.data ? (
            <span className="flex items-center gap-2">
              Dispute {disputeQuery.data.id.slice(-4).toUpperCase()}
              <StatusBadge
                status={disputeQuery.data.status}
                tone={DISPUTE_STATUS_TONE[disputeQuery.data.status] ?? "gray"}
              />
            </span>
          ) : (
            "Dispute"
          )
        }
        subtitle={
          disputeQuery.data
            ? `${CATEGORY_LABEL[disputeQuery.data.category]} · order ${disputeQuery.data.order_id.slice(-6).toUpperCase()} · ${money(disputeQuery.data.amount_disputed_cents)} disputed`
            : undefined
        }
      >
        {disputeQuery.data && (
          <DisputeDetail
            dispute={disputeQuery.data}
            canReview={canReview}
            canResolve={canResolve}
            canComment={canComment}
            onResolve={() => setResolveOpen(true)}
          />
        )}
        {disputeQuery.isError && (
          <StateBlock
            variant="error"
            title="Couldn't load this dispute"
            message={apiErrorMessage(disputeQuery.error)}
            onRetry={() => void disputeQuery.refetch()}
            retrying={disputeQuery.isFetching}
          />
        )}
      </Drawer>

      {disputeQuery.data && (
        <ResolveDialog dispute={disputeQuery.data} open={resolveOpen} onClose={() => setResolveOpen(false)} />
      )}
    </div>
  );
}

function DisputeDetail({
  dispute,
  canReview,
  canResolve,
  canComment,
  onResolve,
}: {
  dispute: Dispute;
  canReview: boolean;
  canResolve: boolean;
  canComment: boolean;
  onResolve: () => void;
}) {
  const legal = DISPUTE_TRANSITIONS[dispute.status] ?? [];
  const [comment, setComment] = useState("");
  const commentMutation = useAddDisputeComment(dispute.id);

  return (
    <div className="space-y-6 text-sm">
      <div className="flex flex-wrap gap-2">
        {canReview && dispute.status === "OPEN" && <StartReviewButton dispute={dispute} />}
        {canResolve && legal.some((s) => s.startsWith("RESOLVED")) && (
          <Button variant="destructive" onClick={onResolve}>
            Resolve (money op)…
          </Button>
        )}
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Claim</h3>
        <div className="rounded-lg border border-border bg-card p-3">
          <p>
            {dispute.description}
          </p>
          <p className="mt-2 text-muted-foreground">
            Opened by {dispute.opened_by.toLowerCase()} · {dateTime(dispute.opened_at)} ·{" "}
            {dispute.sla?.breached ? (
              <span className="font-medium text-destructive">Response deadline passed</span>
            ) : (
              "Response on time"
            )}
          </p>
        </div>
      </section>

      {dispute.resolution && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Resolution</h3>
          <div className="rounded-lg border border-border bg-card p-3">
            <p>
              <span className="font-medium">{dispute.resolution.type.replaceAll("_", " ")}</span>{" "}
              {dispute.resolution.amount_cents > 0 && <>· {money(dispute.resolution.amount_cents)}</>}
            </p>
            <p className="mt-1 text-muted-foreground">
              {dispute.resolution.notes} · {dateTime(dispute.resolution.at)} · by {adminName(dispute.resolution.admin_id)}
            </p>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Thread</h3>
        {dispute.comments.length === 0 ? (
          <p className="text-muted-foreground">No comments yet.</p>
        ) : (
          <ol className="space-y-2">
            {dispute.comments.map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-card p-3">
                <p>{c.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {adminName(c.author_admin_id)} · {dateTime(c.at)}
                </p>
              </li>
            ))}
          </ol>
        )}
        {canComment && (
          <form
            className="flex items-start gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const body = comment.trim();
              if (!body) return;
              commentMutation.mutate(
                { body },
                {
                  onSuccess: () => {
                    setComment("");
                    commentMutation.reset();
                  },
                },
              );
            }}
          >
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add an internal note…"
              className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={commentMutation.isPending || comment.trim().length === 0}>
              {commentMutation.isPending ? "Posting…" : "Comment"}
            </Button>
            {commentMutation.isError && (
              <InlineError message={apiErrorMessage(commentMutation.error)} />
            )}
          </form>
        )}
      </section>
    </div>
  );
}

function StartReviewButton({ dispute }: { dispute: Dispute }) {
  const [open, setOpen] = useState(false);
  const mutation = useStartDisputeReview(dispute.id);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Start review…
      </Button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Start review · dispute ${dispute.id.slice(-4).toUpperCase()}`}
        description="Moves the dispute from OPEN to UNDER_REVIEW."
        submitLabel="Start review"
        busy={mutation.isPending}
        error={mutation.isError ? apiErrorMessage(mutation.error) : null}
        onSubmit={({ reason }) =>
          mutation.mutate(
            { reason },
            {
              onSuccess: () => {
                mutation.reset();
                setOpen(false);
              },
            },
          )
        }
      />
    </>
  );
}

function ResolveDialog({ dispute, open, onClose }: { dispute: Dispute; open: boolean; onClose: () => void }) {
  const [type, setType] = useState<"REFUND" | "WALLET_CREDIT" | "PARTIAL">("REFUND");
  const [amountStr, setAmountStr] = useState(String(dispute.amount_disputed_cents / 100));
  const mutation = useResolveDispute(dispute.id);

  const amountCents = Math.round(Number(amountStr) * 100);
  const amountInvalid =
    !Number.isFinite(amountCents) || amountCents < 1 || amountCents > dispute.amount_disputed_cents;

  return (
    <ReasonDialog
      open={open}
      onClose={onClose}
      title={`Resolve · dispute ${dispute.id.slice(-4).toUpperCase()}`}
      description={
        <span>
          Money operation (demo theater, Gap Analysis §3). Max {money(dispute.amount_disputed_cents)}. Sent with an{" "}
          <Term k="idempotency">idempotency key</Term>; retries never double-pay.
        </span>
      }
      submitLabel="Resolve"
      destructive
      busy={mutation.isPending}
      error={
        mutation.isError
          ? apiErrorMessage(mutation.error)
          : amountInvalid
            ? `Amount must be between 0.01 and ${(dispute.amount_disputed_cents / 100).toFixed(2)}.`
            : null
      }
      validate={() => (amountInvalid ? "Fix the amount first." : null)}
      onSubmit={({ reason }) =>
        mutation.mutate(
          { type, amount_cents: amountCents, reason },
          {
            onSuccess: () => {
              mutation.reset();
              onClose();
            },
          },
        )
      }
    >
      <Field label="Resolution type" htmlFor="resolve-type">
        <select
          id="resolve-type"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
        >
          <option value="REFUND">Refund</option>
          <option value="WALLET_CREDIT">Wallet credit</option>
          <option value="PARTIAL">Partial reconciliation</option>
        </select>
      </Field>
      <Field label="Amount (₦)" htmlFor="resolve-amount">
        <input
          id="resolve-amount"
          type="number"
          min={0.01}
          step={0.01}
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
        />
      </Field>
    </ReasonDialog>
  );
}
