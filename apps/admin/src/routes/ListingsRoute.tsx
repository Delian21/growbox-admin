/**
 * Listings approval queue (approval-queue extension of the Phase 1 contract —
 * see listing-types.ts in the api-client): TanStack Table list with status
 * filter, detail drawer with the review history, and the reason-gated
 * approve / reject / archive actions. The mock enforces the §5-style machine
 * (LISTING_TRANSITIONS) per request; RBAC gating here is UX only.
 */

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  LISTING_TRANSITIONS,
  VENDOR_BY_ID,
  can,
  type Listing,
  type ListingStatus,
} from "@growbox/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Drawer } from "@/components/Drawer";
import { ReasonDialog } from "@/components/ReasonDialog";
import { StateBlock, InlineError } from "@/components/StateBlock";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/auth/AuthProvider";
import { dateTime, money } from "@/lib/format";
import { adminName } from "@/lib/adminName";
import { Term } from "@/components/Term";
import { apiErrorMessage, useAddListingComment, useListing, useListingAction, useListings } from "@/api/hooks";

const STATUSES: readonly ListingStatus[] = ["PENDING_REVIEW", "DRAFT", "APPROVED", "REJECTED", "ARCHIVED"];

/** Human labels — the queue speaks "awaiting review", not "PENDING_REVIEW". */
const STATUS_LABEL: Record<ListingStatus, string> = {
  DRAFT: "Draft (not submitted)",
  PENDING_REVIEW: "Awaiting review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

const STATUS_TONE: Record<ListingStatus, "amber" | "gray" | "green" | "red"> = {
  DRAFT: "gray",
  PENDING_REVIEW: "amber",
  APPROVED: "green",
  REJECTED: "red",
  ARCHIVED: "gray",
};

function StatusHeader() {
  return <Term k="override">Review status</Term>;
}

/** The three review ops mapped to dialog copy + destructive flag. */
const ACTIONS = [
  { action: "approve", label: "Approve…", title: "Approve listing", destructive: false },
  { action: "reject", label: "Reject…", title: "Reject listing", destructive: true },
  { action: "archive", label: "Archive…", title: "Archive listing", destructive: false },
] as const;

type ActionName = (typeof ACTIONS)[number]["action"];

export function ListingsRoute() {
  const [filters, setFilters] = useState<{ status?: ListingStatus }>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listingQuery = useListing(selectedId);
  const listingsQuery = useListings(filters);

  const columns = useMemo<ColumnDef<Listing, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Listing",
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.title}
            <span className="block text-xs font-normal text-muted-foreground">{row.original.category}</span>
          </span>
        ),
      },
      {
        id: "vendor",
        accessorFn: (l) => VENDOR_BY_ID.get(l.vendor_id)?.business_name ?? l.vendor_id,
        header: "Vendor",
        cell: ({ row }) => VENDOR_BY_ID.get(row.original.vendor_id)?.business_name ?? row.original.vendor_id,
      },
      {
        accessorKey: "status",
        header: () => <StatusHeader />,
        cell: ({ row }) => (
          <StatusBadge
            status={STATUS_LABEL[row.original.status]}
            tone={STATUS_TONE[row.original.status]}
          />
        ),
      },
      {
        accessorKey: "price_cents",
        header: "Price",
        meta: { align: "right" as const },
        cell: ({ row }) => money(row.original.price_cents),
      },
      {
        id: "unit",
        header: "Unit",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.unit}</span>,
      },
      {
        accessorKey: "submitted_at",
        header: "Submitted",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.submitted_at ? dateTime(row.original.submitted_at) : "–"}
          </span>
        ),
      },
    ],
    [],
  );

  const rows = listingsQuery.data?.data ?? [];
  const pendingCount =
    listingsQuery.data?.total_by_status?.PENDING_REVIEW ??
    rows.filter((l) => l.status === "PENDING_REVIEW").length;

  return (
    <div>
      <PageHeader
        title="Listings"
        description="Vendor product submissions: review, approve, or reject with a reason. Rejections and approvals are audited."
      />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={listingsQuery.isLoading}
        error={listingsQuery.isError ? apiErrorMessage(listingsQuery.error) : null}
        onRetry={() => void listingsQuery.refetch()}
        onRowClick={(l) => setSelectedId(l.id)}
        emptyTitle="No listings match the filter"
        emptyMessage="Try a different status filter, or check back after vendors submit new products."
        toolbar={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              aria-label="Filter by status"
              className="rounded-md border border-input bg-card px-2 py-1.5"
              value={filters.status ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: (e.target.value || undefined) as ListingStatus }))
              }
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <span className="ml-auto text-xs text-muted-foreground">
              {pendingCount} awaiting review · {rows.length} listing{rows.length === 1 ? "" : "s"}
            </span>
          </div>
        }
      />

      <Drawer
        open={selectedId != null}
        onClose={() => setSelectedId(null)}
        title={
          listingQuery.data ? (
            <span className="flex items-center gap-2">
              {listingQuery.data.title}
              <StatusBadge status={STATUS_LABEL[listingQuery.data.status]} tone={STATUS_TONE[listingQuery.data.status]} />
            </span>
          ) : (
            "Listing"
          )
        }
        subtitle={
          listingQuery.data
            ? `${VENDOR_BY_ID.get(listingQuery.data.vendor_id)?.business_name ?? listingQuery.data.vendor_id} · ${listingQuery.data.category}`
            : undefined
        }
      >
        {listingQuery.data && <ListingDetail listing={listingQuery.data} />}
        {listingQuery.isError && (
          <StateBlock
            variant="error"
            title="Couldn't load this listing"
            message={apiErrorMessage(listingQuery.error)}
            onRetry={() => void listingQuery.refetch()}
            retrying={listingQuery.isFetching}
          />
        )}
      </Drawer>
    </div>
  );
}

function ListingDetail({ listing }: { listing: Listing }) {
  const { admin } = useAuth();
  const legal = LISTING_TRANSITIONS[listing.status] ?? [];
  const allowed = (op: Parameters<typeof can>[1]) => (admin ? can(admin.role, op) : false);

  return (
    <div className="space-y-6 text-sm">
      <div className="flex flex-wrap gap-2">
        {allowed("listings:approve") && legal.includes("APPROVED") && listing.status !== "APPROVED" && (
          <ActionButton listing={listing} action="approve" />
        )}
        {allowed("listings:reject") && legal.includes("REJECTED") && (
          <ActionButton listing={listing} action="reject" />
        )}
        {allowed("listings:approve") && legal.includes("ARCHIVED") && listing.status !== "ARCHIVED" && (
          <ActionButton listing={listing} action="archive" />
        )}
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Details</h3>
        <dl className="grid grid-cols-2 gap-3">
          <Detail label="Price" value={`${money(listing.price_cents)} per ${listing.unit}`} />
          <Detail label="Stock" value={`${listing.stock_kg.toLocaleString("en-NG")} kg`} />
          <Detail label="Submitted" value={listing.submitted_at ? dateTime(listing.submitted_at) : "Not yet submitted"} />
          <Detail label="Last reviewed" value={listing.reviewed_at ? dateTime(listing.reviewed_at) : "–"} />
        </dl>
        <p className="rounded-lg bg-muted/60 p-3 leading-relaxed text-muted-foreground">{listing.description}</p>
      </section>

      <CommentThread listing={listing} />

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Review history ({listing.review_history.length})
        </h3>
        {listing.review_history.length === 0 ? (
          <p className="text-muted-foreground">No review decisions yet.</p>
        ) : (
          <ol className="space-y-2">
            {listing.review_history.map((r, i) => (
              <li key={`${r.at}-${i}`} className="rounded-lg border border-border bg-card p-3">
                <p>
                  <StatusBadge
                    className="mr-2"
                    status={r.action}
                    tone={r.action === "APPROVED" ? "green" : r.action === "REJECTED" ? "red" : "gray"}
                  />
                  {r.reason}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {adminName(r.admin_id)} · {dateTime(r.at)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

const commentInputCls =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/**
 * Reviewer discussion: notes for other reviewers, kept separate from the
 * decision trail. Anyone who can read listings can weigh in (mirrors the
 * mock's permission choice); posting is audited server-side.
 */
function CommentThread({ listing }: { listing: Listing }) {
  const mutation = useAddListingComment(listing.id);
  const [body, setBody] = useState("");

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    mutation.mutate({ body: trimmed }, { onSuccess: () => setBody("") });
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Reviewer discussion ({listing.comments.length})
      </h3>
      {listing.comments.length === 0 ? (
        <p className="text-muted-foreground">No notes yet. Leave context for the reviewer who acts on this.</p>
      ) : (
        <ul className="space-y-2">
          {listing.comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card p-3">
              <p className="leading-relaxed">{c.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {adminName(c.author_admin_id)} · {dateTime(c.at)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={commentInputCls}
          placeholder="Add a note for other reviewers…"
          aria-label="Reviewer comment"
        />
        {mutation.isError && <InlineError message={apiErrorMessage(mutation.error)} />}
        <div className="flex justify-end">
          <Button type="submit" disabled={!body.trim() || mutation.isPending}>
            {mutation.isPending ? "Posting…" : "Comment"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function ActionButton({ listing, action }: { listing: Listing; action: ActionName }) {
  const [open, setOpen] = useState(false);
  const meta = ACTIONS.find((a) => a.action === action)!;
  const mutation = useListingAction(listing.id);

  return (
    <>
      <Button
        variant={meta.destructive ? "destructive" : "outline"}
        onClick={() => {
          mutation.reset();
          setOpen(true);
        }}
      >
        {meta.label}
      </Button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`${meta.title} · ${listing.title}`}
        description={
          action === "reject"
            ? "The vendor sees this reason in their submission portal. Be specific about what to fix."
            : action === "archive"
              ? "Archived listings are hidden from the catalogue but keep their audit trail."
              : undefined
        }
        submitLabel={meta.title.replace(" listing", "")}
        destructive={meta.destructive}
        busy={mutation.isPending}
        error={mutation.isError ? apiErrorMessage(mutation.error) : null}
        onSubmit={({ reason }) =>
          mutation.mutate(
            { action, reason },
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
