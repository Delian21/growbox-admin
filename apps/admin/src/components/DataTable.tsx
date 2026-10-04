/**
 * Generic data table over TanStack Table (ADR-002). Column defs own their
 * filters; the shell owns loading/error/empty states. Sorting is
 * client-side for the demo — the contract paginates server-side and the
 * swap keeps this component unchanged.
 *
 * States (TODO §7): skeleton rows while loading; a styled empty state with
 * title + hint; an error card with a retry action that refetches the query.
 */

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useState, type ReactNode } from "react";
import { AlertTriangleIcon, PackageIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { cn } from "@/lib/utils";

/**
 * Column metadata. `align: "right"` right-aligns both header and cell and
 * switches the font to tabular figures, so digits line up by place value and
 * a column of money can be scanned instead of read one row at a time.
 */
declare module "@tanstack/table-core" {
  // TS requires an augmentation's type parameters to match the base
  // declaration exactly (names included), and an empty-constraint body cannot
  // reference them — so the unused-vars rule is structurally unsatisfiable here.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "right";
    /** Plain-text name for the column picker (headers that are components). */
    label?: string;
  }
}

/**
 * Plain-text column name for the picker. Headers may be components (glossary
 * Terms, sort buttons), so we prefer `meta.label`, then a string header, then
 * a prettified accessor — never `String()` on a React element.
 */
function columnLabel<TData extends RowData, TValue>(
  col: { id: string; columnDef: ColumnDef<TData, TValue> },
): string {
  const meta = col.columnDef.meta?.label;
  if (meta) return meta;
  const header = col.columnDef.header;
  if (typeof header === "string") return header;
  const raw = (col.columnDef as { accessorKey?: string }).accessorKey ?? col.id;
  const leaf = raw.split(".").pop() ?? raw;
  return leaf.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  isLoading?: boolean;
  error?: string | null;
  /** Refetch callback for the error state's retry button. */
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  /** Empty-state headline; `emptyMessage` stays for custom body copy. */
  emptyTitle?: string;
  emptyMessage?: string;
  toolbar?: ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  error,
  onRetry,
  onRowClick,
  emptyTitle = "Nothing here yet",
  emptyMessage,
  toolbar,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnsOpen, setColumnsOpen] = useState(false);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  /** Columns the picker may toggle — everything except identity/action cols. */
  const hideable = table.getAllColumns().filter((c) => c.getCanHide());
  const hiddenCount = hideable.filter((c) => !c.getIsVisible()).length;

  if (error) {
    return (
      <div className="space-y-3">
        {toolbar}
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-10 text-center"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive dark:text-red-300">
            <AlertTriangleIcon size={18} />
          </span>
          <div>
            <p className="text-sm font-medium text-destructive dark:text-red-300">Couldn't load this table</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              {error} The demo mock simulates occasional transient failures; retrying usually clears it.
            </p>
          </div>
          {onRetry && (
            <Button variant="outline" onClick={onRetry} disabled={isLoading}>
              {isLoading ? "Retrying…" : "Retry"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const rows = table.getRowModel().rows;

  const columnPicker =
    hideable.length > 1 ? (
      <Menu
        label="Choose columns"
        open={columnsOpen}
        onOpenChange={setColumnsOpen}
        align="right"
        trigger={
          <>
            Columns
            {hiddenCount > 0 ? (
              <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px] font-semibold">
                {hiddenCount}
              </span>
            ) : null}
          </>
        }
      >
        {hideable.map((col) => (
          <MenuItem
            key={col.id}
            checked={col.getIsVisible()}
            onSelect={() => col.toggleVisibility()}
          >
            <span className="flex-1">{columnLabel(col)}</span>
          </MenuItem>
        ))}
        <div className="my-1 border-t border-border" />
        <MenuItem
          onSelect={() => setColumnVisibility({})}
          disabled={hiddenCount === 0}
        >
          Show all
        </MenuItem>
      </Menu>
    ) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">{toolbar}</div>
        {columnPicker ? <div className="shrink-0">{columnPicker}</div> : null}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      "px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase",
                      header.column.columnDef.meta?.align === "right"
                        ? "text-right tabular-nums"
                        : "text-left",
                    )}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="text-[10px]">
                          {{ asc: "▲", desc: "▼" }[header.column.getIsSorted() as string] ?? ""}
                        </span>
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0" aria-hidden="true">
                  {columns.map((_, j) => (
                    <td key={j} className="px-3 py-3">
                      <div
                        className="h-3.5 animate-pulse rounded bg-muted"
                        style={{ animationDelay: `${(i * columns.length + j) * 40}ms` }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                    <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <PackageIcon size={18} />
                    </span>
                    <p className="text-sm font-medium">{emptyTitle}</p>
                    <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                      {emptyMessage ?? "When items appear they will show up here."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border/60 last:border-0",
                    onRowClick && "cursor-pointer transition-colors hover:bg-muted/60",
                  )}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-3 py-2.5 align-middle",
                        cell.column.columnDef.meta?.align === "right" && "text-right tabular-nums",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
