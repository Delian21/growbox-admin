/**
 * Analytics screen (Phase 3, TODO §6): GMV trend, take rate, quality signals,
 * and the vendor leaderboard. Every figure is derived by the mock from the
 * live order/vendor/dispute stores, so the charts can never disagree with the
 * tables elsewhere in the app. Charts are hand-rolled SVG on the --chart-N
 * design tokens — no charting dependency, matching the dashboard sparkline.
 */

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { StateBlock } from "@/components/StateBlock";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/auth/AuthProvider";
import { can } from "@growbox/api-client";
import { money, pct, dateOnly } from "@/lib/format";
import { apiErrorMessage, useGmvSeries, useLeaderboard, useQualitySignals, useTakeRate } from "@/api/hooks";

const WINDOWS = [7, 14, 30] as const;

export function AnalyticsRoute() {
  const { admin } = useAuth();
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(14);

  const gmv = useGmvSeries(days);
  const takeRate = useTakeRate();
  const quality = useQualitySignals();
  const leaderboard = useLeaderboard();

  const series = useMemo(() => gmv.data?.series ?? [], [gmv.data]);

  if (!admin || !can(admin.role, "analytics:read")) {
    return (
      <div>
        <PageHeader title="Analytics" description="Performance reporting across the marketplace." />
        <p className="text-sm text-muted-foreground">
          Your role does not include analytics access. Ask a super admin to grant it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="GMV, take rate, quality signals, and vendor ranking — all computed from the live order ledger."
        actions={
          <div className="flex gap-1" role="group" aria-label="Time window">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setDays(w)}
                aria-pressed={days === w}
                className={`rounded-md border px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  days === w
                    ? "border-ring bg-accent text-accent-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-ring/50"
                }`}
              >
                {w} days
              </button>
            ))}
          </div>
        }
      />

      {/* Headline figures */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Figure
          label="GMV (window)"
          value={gmv.isLoading ? "…" : money(gmv.data?.total_gmv_cents ?? 0)}
          error={gmv.isError ? apiErrorMessage(gmv.error) : null}
          sub={`${gmv.data?.total_orders ?? 0} orders`}
        />
        <Figure
          label="Take rate"
          value={takeRate.isLoading ? "…" : pct(takeRate.data?.take_rate ?? 0)}
          error={takeRate.isError ? apiErrorMessage(takeRate.error) : null}
          sub={`${money(takeRate.data?.commission_cents ?? 0)} commission · 30 days`}
        />
        <Figure
          label="Cancellation rate"
          value={quality.isLoading ? "…" : pct(quality.data?.cancellation_rate ?? 0)}
          error={quality.isError ? apiErrorMessage(quality.error) : null}
          sub={`${quality.data?.spoilage_complaints ?? 0} spoilage complaints`}
        />
        <Figure
          label="Late shipments"
          value={quality.isLoading ? "…" : pct(quality.data?.late_shipment_rate ?? 0)}
          error={quality.isError ? apiErrorMessage(quality.error) : null}
          sub={`${quality.data?.disputes_open ?? 0} disputes open`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="GMV trend"
          subtitle={<span>Revenue per day, last {days} days · cancelled and refunded sales excluded</span>}
          className="lg:col-span-2"
        >
          {gmv.isLoading ? (
            <StateBlock variant="loading" />
          ) : gmv.isError ? (
            <StateBlock
              variant="error"
              message={apiErrorMessage(gmv.error)}
              onRetry={() => void gmv.refetch()}
              retrying={gmv.isFetching}
            />
          ) : (
            <BarChart
              data={series.map((d) => ({ label: d.date, value: d.gmv_cents, hint: `${d.orders} orders` }))}
              format={(v) => money(v)}
            />
          )}
        </Panel>

        <Panel title="Vendor leaderboard" subtitle="Ranked by GMV over all time">
          {leaderboard.isLoading ? (
            <StateBlock variant="loading" />
          ) : leaderboard.isError ? (
            <StateBlock
              variant="error"
              message={apiErrorMessage(leaderboard.error)}
              onRetry={() => void leaderboard.refetch()}
              retrying={leaderboard.isFetching}
            />
          ) : (
            <ol className="space-y-2">
              {(leaderboard.data ?? []).map((row) => (
                <li key={row.vendor_id} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-xs text-muted-foreground">{row.rank}</span>
                    <span className="truncate">{row.business_name}</span>
                    {row.cancellation_rate >= 0.1 ? (
                      <StatusBadge status="at risk" tone="red" />
                    ) : null}
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground">{money(row.gmv_cents)}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Figure({ label, value, sub, error }: { label: string; value: string; sub: string; error?: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className={`mt-1 text-xs ${error ? "text-destructive dark:text-red-300" : "text-muted-foreground"}`}>
        {error ?? sub}
      </p>
    </div>
  );
}

interface BarDatum {
  label: string;
  value: number;
  hint?: string;
}

/**
 * Column chart with a fixed x-axis so days without sales stay visible.
 * Values are scaled against the peak; zero days render as a hairline.
 * Dashboard parity: baseline rule, peak scale label, hover value per bar.
 */
function BarChart({ data, format }: { data: BarDatum[]; format: (v: number) => string }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No data in this window.</p>;

  const max = Math.max(...data.map((d) => d.value), 1);
  const showEvery = Math.ceil(data.length / 7);
  const gapCls = data.length > 14 ? "gap-px" : "gap-[2px]";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="tabular-nums">{format(max)}</span>
        <span>peak</span>
      </div>
      <div
        className={`flex h-40 items-end border-b border-border ${gapCls}`}
        role="img"
        aria-label={`Column chart, ${data.length} days, peak ${format(max)}`}
      >
        {data.map((d, i) => {
          const h = d.value === 0 ? 1 : Math.max(3, Math.round((d.value / max) * 100));
          return (
            <div key={`${d.label}-${i}`} className="group relative flex h-full min-w-0 flex-1 items-end">
              <span className="absolute inset-x-0 top-0 truncate text-center text-[10px] font-medium whitespace-nowrap text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {format(d.value)}
              </span>
              <div
                className="w-full rounded-t-sm bg-[var(--chart-1)] transition-all group-hover:opacity-75"
                style={{ height: `${h}%` }}
                title={`${dateOnly(d.label)} · ${format(d.value)}${d.hint ? ` · ${d.hint}` : ""}`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[11px] text-muted-foreground">
        {data
          .map((d, i) => ({ d, i }))
          .filter(({ i }) => i % showEvery === 0)
          .map(({ d, i }) => (
            <span key={`${d.label}-tick-${i}`}>{dateOnly(d.label).slice(5)}</span>
          ))}
      </div>
    </div>
  );
}
