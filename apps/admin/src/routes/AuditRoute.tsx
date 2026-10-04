/**
 * Audit Log screen (Phase 1, TODO.md §4): read-only table with actor /
 * entity / date filters. Append-only invariant (§5) — deliberately no edit,
 * delete, or export affordance anywhere in this route.
 */

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { apiErrorMessage, useAuditLog, type AuditEntry, type AuditFilters, type AuditEntityType } from "@/api/hooks";
import { dateTime } from "@/lib/format";
import { adminName } from "@/lib/adminName";

const ENTITY_TYPES: readonly AuditEntityType[] = ["ORDER", "DISPUTE", "VENDOR"];

export function AuditRoute() {
  const [filters, setFilters] = useState<AuditFilters>({});
  const auditQuery = useAuditLog(filters);

  const columns = useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      {
        accessorKey: "at",
        header: "When",
        cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{dateTime(row.original.at)}</span>,
      },
      {
        accessorKey: "actor_admin_id",
        header: "Admin",
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-medium">{adminName(row.original.actor_admin_id)}</span>
        ),
      },
      { accessorKey: "action", header: "Action" },
      {
        accessorKey: "entity_type",
        header: "Entity",
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.entity_type}{" "}
            <span className="font-mono text-xs text-muted-foreground">{row.original.entity_id.slice(-6).toUpperCase()}</span>
          </span>
        ),
      },
      {
        id: "change",
        header: "Before → After",
        accessorFn: (e) => JSON.stringify([e.before, e.after]),
        cell: ({ row }) => <ChangeCell before={row.original.before} after={row.original.after} />,
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.reason}</span>,
      },
      {
        accessorKey: "ip",
        header: "IP",
        cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.ip}</span>,
      },
    ],
    [],
  );

  const rows = auditQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Append-only trail of every admin mutation. Read-only by design: there is no edit or delete path in the API or this UI."
      />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={auditQuery.isLoading}
        error={auditQuery.isError ? apiErrorMessage(auditQuery.error) : null}
        onRetry={() => void auditQuery.refetch()}
        emptyTitle="No audit entries match the filters"
        emptyMessage="Every admin mutation lands here automatically, so an empty result just means the filters are too narrow."
        toolbar={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input
              aria-label="Filter by admin"
              placeholder="Filter by admin ID (adm_…)"
              className="w-56 rounded-md border border-input bg-card px-2 py-1.5 font-mono text-xs"
              value={filters.actor ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, actor: e.target.value || undefined }))}
            />
            <select
              aria-label="Filter by entity type"
              className="rounded-md border border-input bg-card px-2 py-1.5"
              value={filters.entity_type ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, entity_type: (e.target.value || undefined) as AuditEntityType }))
              }
            >
              <option value="">All entities</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-muted-foreground">
              From
              <input
                type="date"
                className="rounded-md border border-input bg-card px-2 py-1.5"
                value={filters.date_from ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value || undefined }))}
              />
            </label>
            <label className="flex items-center gap-1.5 text-muted-foreground">
              To
              <input
                type="date"
                className="rounded-md border border-input bg-card px-2 py-1.5"
                value={filters.date_to ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value || undefined }))}
              />
            </label>
            <span className="ml-auto text-xs text-muted-foreground">
              {rows.length} entr{rows.length === 1 ? "y" : "ies"}
            </span>
          </div>
        }
      />
    </div>
  );
}

function ChangeCell({ before, after }: { before: Record<string, unknown> | null | undefined; after: Record<string, unknown> | null | undefined }) {
  if (!before && !after) return <span className="text-muted-foreground">–</span>;
  return (
    <span className="font-mono text-xs">
      {before ? JSON.stringify(before) : "∅"} <span className="text-muted-foreground">→</span>{" "}
      {after ? JSON.stringify(after) : "∅"}
    </span>
  );
}
