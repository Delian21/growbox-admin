/** Bordered card with a title + optional subtitle, right-side `stat` (hero
 * metric) and `actions` slots. Shared by Dashboard and Analytics. */
import type { ReactNode } from "react";

export interface PanelStatValue {
  value: string;
  /** Quieter caption under the figure. */
  caption?: string;
  /** Variance chip shown beside the figure. */
  delta?: { dir: "up" | "down" | "flat"; label: string } | null;
}

export function Panel({
  title,
  subtitle,
  stat,
  actions,
  className,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Dominant metric rendered in the header (hero-metric treatment). */
  stat?: PanelStatValue;
  /** Right-side controls (e.g. scope selector), rendered after the stat. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-4 shadow-sm ${className ?? ""}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {(stat || actions) && (
          <div className="flex shrink-0 items-center gap-3">
            {stat && (
              <div className="text-right">
                <p className="font-display text-xl leading-tight font-semibold tracking-tight tabular-nums">
                  {stat.value}
                </p>
                <div className="flex items-center justify-end gap-1.5">
                  {stat.delta && (
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[11px] font-medium ${
                        stat.delta.dir === "up"
                          ? "bg-success/10 text-emerald-800 dark:text-emerald-300"
                          : stat.delta.dir === "down"
                            ? "bg-destructive/10 text-destructive dark:text-red-300"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {stat.delta.dir === "up" ? "▲" : stat.delta.dir === "down" ? "▼" : "•"}{" "}
                      {stat.delta.label}
                    </span>
                  )}
                  {stat.caption && (
                    <span className="text-[11px] text-muted-foreground">{stat.caption}</span>
                  )}
                </div>
              </div>
            )}
            {actions}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
