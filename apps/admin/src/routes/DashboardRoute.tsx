/**
 * Dashboard (Phase 1, TODO.md §4): stat cards with trend hints over the Phase 1
 * mock surface — GMV today, open disputes, SLA-breached orders, vendor health —
 * plus minimal Tremor-style charts (GMV trend, dispute mix, vendor watchlist).
 * Charts are hand-rolled SVG fed by the same queries as the tables, so the
 * numbers always agree; the chart tokens (--chart-1..5) do the coloring.
 */

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { money, pct, dateTime } from "@/lib/format";
import { adminName } from "@/lib/adminName";
import { Term } from "@/components/Term";
import {
  apiErrorMessage,
  api,
  currentToken,
  useDisputes,
  useListings,
  useOrders,
  useVendors,
  type AuditEntry,
  type Dispute,
  type Listing,
  type Order,
  type Vendor,
} from "@/api/hooks";
import { AlertTriangleIcon, ChevronDownIcon, TrendDownIcon, TrendUpIcon } from "@/components/icons";
import { StatusBadge, VENDOR_STATUS_TONE } from "@/components/StatusBadge";
import { Panel } from "@/components/Panel";
import { StateBlock } from "@/components/StateBlock";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { useState, type ReactNode } from "react";

export function DashboardRoute() {
  const { admin } = useAuth();
  const [mixDays, setMixDays] = useState(30);
  const [mixScopeOpen, setMixScopeOpen] = useState(false);
  const [trendDays, setTrendDays] = useState(7);
  const [trendScopeOpen, setTrendScopeOpen] = useState(false);
  const ordersQuery = useOrders({});
  const disputesQuery = useDisputes({});
  const vendorsQuery = useVendors({});
  const listingsQuery = useListings({});

  const orders = ordersQuery.data?.data ?? [];
  const disputes = disputesQuery.data?.data ?? [];
  const vendors = vendorsQuery.data?.data ?? [];
  const listings = listingsQuery.data?.data ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const gmvToday = orders
    .filter((o) => o.created_at.startsWith(today))
    .reduce((sum, o) => sum + o.totals.total_cents, 0);
  const gmvYesterday = orders
    .filter((o) => o.created_at.startsWith(nextDay(today, -1)))
    .reduce((sum, o) => sum + o.totals.total_cents, 0);
  const slaBreached = orders.filter((o) => o.sla.breached).length;
  const openDisputes = disputes.filter((d) => d.status === "OPEN").length;
  const underReview = disputes.filter((d) => d.status === "UNDER_REVIEW").length;
  const poorVendors = vendors.filter(
    (v) =>
      v.performance.cancellation_rate >= 0.1 ||
      v.performance.late_shipment_rate >= 0.15 ||
      v.performance.spoilage_complaints >= 20,
  ).length;
  // Approval-queue summary (Phase 2 gate): nothing publishes without review.
  // Counts come from the mock's per-status facet so they stay accurate even
  // when the queue spans more than one page of results.
  const pendingListings =
    listingsQuery.data?.total_by_status?.PENDING_REVIEW ??
    listings.filter((l) => l.status === "PENDING_REVIEW").length;
  const totalListings = listingsQuery.data?.total ?? listings.length;
  // Live dispute SLA breaches (not merely "open") are the only dispute state
  // worth amber framing; a normal open queue is routine work.
  const liveDisputeBreaches = disputes.filter(
    (d) => d.sla?.breached && (d.status === "OPEN" || d.status === "UNDER_REVIEW"),
  ).length;
  // 14-day micro-chart series, one per KPI card — all derived from the same
  // queries as the tables. "Poor performers" has no history, so it gets a
  // ratio bar instead of an invented trend.
  const days14 = Array.from({ length: 14 }, (_, i) => nextDay(today, i - 13));
  const gmvSeries = days14.map((day) =>
    orders.filter((o) => o.created_at.startsWith(day)).reduce((s, o) => s + o.totals.total_cents, 0),
  );
  const openedSeries = days14.map((day) => disputes.filter((d) => d.opened_at.startsWith(day)).length);
  const breachSeries = days14.map((day) =>
    orders.filter((o) => o.sla.breached && (o.sla.breached_at ?? o.created_at).startsWith(day)).length,
  );
  const listingSeries = days14.map((day) =>
    listings.filter((l) => l.submitted_at?.startsWith(day)).length,
  );
  // Variance indicators (today vs yesterday) + panel hero figures, all derived
  // from the same series as the cards so the numbers can never disagree.
  const gmvDeltaPct = gmvYesterday > 0 ? ((gmvToday - gmvYesterday) / gmvYesterday) * 100 : null;
  // Sales-trend window: current scope + the equally-long previous scope so the
  // delta stays honest at 7/30/90 days (derived from orders, not the 14-day
  // card series, which can't cover a 90-day window).
  const gmvWindow = gmvSum(orders, trendDays, 0);
  const gmvPrevWindow = gmvSum(orders, trendDays, trendDays);
  const gmvWindowPct = gmvPrevWindow > 0 ? ((gmvWindow - gmvPrevWindow) / gmvPrevWindow) * 100 : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Welcome back, <span className="font-medium text-foreground">{admin?.name.split(" ")[0]}</span>. Today's
            sales, disputes and vendor health at a glance.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{admin?.role} · demo data</p>
      </div>

      {/* Bento grid: hero sales card (2 cols) + compact secondary cards. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="sm:col-span-2">
          <StatCard
            hero
            label={<Term k="gmv">Sales today (GMV)</Term>}
            value={money(gmvToday)}
            loading={ordersQuery.isLoading}
            error={ordersQuery.isError ? apiErrorMessage(ordersQuery.error) : null}
            variance={
              gmvDeltaPct === null
                ? null
                : {
                    dir: gmvToday >= gmvYesterday ? "up" : "down",
                    value: `${Math.abs(gmvDeltaPct).toFixed(1)}%`,
                    label: "vs yesterday",
                  }
            }
            series={gmvSeries}
          />
        </div>
        <StatCard
          label="Open disputes"
          value={String(openDisputes)}
          loading={disputesQuery.isLoading}
          error={disputesQuery.isError ? apiErrorMessage(disputesQuery.error) : null}
          to="/disputes"
          alert={liveDisputeBreaches > 0}
          meta={`${underReview} under review`}
          variance={countVariance(openedSeries)}
          series={openedSeries}
        />
        <StatCard
          label="Past-deadline orders"
          value={String(slaBreached)}
          loading={ordersQuery.isLoading}
          error={ordersQuery.isError ? apiErrorMessage(ordersQuery.error) : null}
          to="/orders"
          alert={slaBreached > 0}
          meta={`${orders.length} orders tracked`}
          variance={countVariance(breachSeries)}
          series={breachSeries}
        />
        <StatCard
          label="Listings awaiting review"
          value={String(pendingListings)}
          loading={listingsQuery.isLoading}
          error={listingsQuery.isError ? apiErrorMessage(listingsQuery.error) : null}
          to="/listings"
          meta={`${totalListings} listings tracked`}
          variance={countVariance(listingSeries)}
          series={listingSeries}
        />
        <StatCard
          label="Poor performers"
          value={String(poorVendors)}
          loading={vendorsQuery.isLoading}
          error={vendorsQuery.isError ? apiErrorMessage(vendorsQuery.error) : null}
          to="/vendors"
          meta={`${vendors.length} vendors total`}
          ratio={{ part: poorVendors, total: vendors.length }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Sales trend"
          subtitle={
            <span>
              Order value placed per day, last {trendDays} days · <Term k="gmv">what GMV means</Term>
            </span>
          }
          stat={{
            value: money(gmvWindow),
            caption: `last ${trendDays} days`,
            delta:
              gmvWindowPct === null
                ? null
                : {
                    dir: gmvWindow >= gmvPrevWindow ? "up" : "down",
                    label: `${Math.abs(gmvWindowPct).toFixed(1)}%`,
                  },
          }}
          actions={
            <Menu
              label="Sales trend time window"
              open={trendScopeOpen}
              onOpenChange={setTrendScopeOpen}
              align="right"
              trigger={
                <>
                  Last {trendDays} days
                  <ChevronDownIcon size={14} className="text-muted-foreground" />
                </>
              }
            >
              {[7, 30, 90].map((d) => (
                <MenuItem key={d} checked={trendDays === d} onSelect={() => setTrendDays(d)}>
                  Last {d} days
                </MenuItem>
              ))}
            </Menu>
          }
          className="lg:col-span-2"
        >
          <GmvTrend orders={orders} days={trendDays} />
        </Panel>
        <Panel
          title="Dispute mix"
          subtitle="By resolution state"
          actions={
            <Menu
              label="Dispute mix time window"
              open={mixScopeOpen}
              onOpenChange={setMixScopeOpen}
              align="right"
              trigger={
                <>
                  Last {mixDays} days
                  <ChevronDownIcon size={14} className="text-muted-foreground" />
                </>
              }
            >
              {[7, 30, 90].map((d) => (
                <MenuItem key={d} checked={mixDays === d} onSelect={() => setMixDays(d)}>
                  Last {d} days
                </MenuItem>
              ))}
            </Menu>
          }
        >
          <DisputeMix disputes={disputes} days={mixDays} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Vendor watchlist"
          subtitle="Breaching performance thresholds"
          stat={{ value: String(poorVendors), caption: "of " + vendors.length + " vendors" }}
          className="lg:col-span-2"
        >
          <VendorWatchlist vendors={vendors} loading={vendorsQuery.isLoading} />
        </Panel>
        <RecentActivity />
      </div>
    </div>
  );
}

function nextDay(isoDate: string, delta: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Sum of order GMV over `count` days ending `offset` days ago (0 = today). */
function gmvSum(orders: Order[], count: number, offset: number): number {
  const today = new Date().toISOString().slice(0, 10);
  let sum = 0;
  for (let i = offset; i < offset + count; i++) {
    const day = nextDay(today, -i);
    sum += orders.filter((o) => o.created_at.startsWith(day)).reduce((s, o) => s + o.totals.total_cents, 0);
  }
  return sum;
}

// ----------------------------------------------------------------- stat card

/** Today-vs-yesterday delta from a 14-day daily series (last = today). */
function countVariance(series: number[]): { dir: "up" | "down"; value: string; label: string } | null {
  const today = series.at(-1) ?? 0;
  const yesterday = series.at(-2) ?? 0;
  const diff = today - yesterday;
  if (diff === 0) return null;
  return { dir: diff > 0 ? "up" : "down", value: `${diff > 0 ? "+" : "−"}${Math.abs(diff)}`, label: "vs yesterday" };
}

function StatCard({
  label: labelProp,
  value,
  hint,
  meta,
  loading,
  error,
  to,
  alert,
  variance,
  hero,
  series,
  ratio,
}: {
  label: ReactNode;
  value: string;
  hint?: string;
  meta?: string;
  loading?: boolean;
  error?: string | null;
  to?: string;
  /** Amber framing — reserve for genuinely urgent states, never queues. */
  alert?: boolean;
  /** Today-vs-yesterday delta chip — replaces the old decorative icon chip. */
  variance?: { dir: "up" | "down"; value: string; label: string } | null;
  /** Hero variant: oversized figure (bento focal point). */
  hero?: boolean;
  /** 14-day daily values rendered as a micro area chart. */
  series?: number[];
  /** Part-of-whole fallback for KPIs with no time history. */
  ratio?: { part: number; total: number };
}) {
  const inner = (
    <div
      className={`group h-full rounded-xl border p-4 transition-all ${
        alert
          ? "border-warning/50 bg-warning/5 shadow-sm hover:shadow-md hover:shadow-warning/10"
          : "border-border bg-card shadow-sm hover:shadow-md"
      } ${to ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground">{labelProp}</p>
        {variance && !loading && !error && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
              variance.dir === "up"
                ? "bg-success/10 text-emerald-800 dark:text-emerald-300"
                : "bg-destructive/10 text-destructive dark:text-red-300"
            }`}
            title={variance.label}
          >
            {variance.dir === "up" ? <TrendUpIcon size={11} /> : <TrendDownIcon size={11} />}
            {variance.value}
          </span>
        )}
      </div>
      <p
        className={`mt-1 font-display font-semibold tracking-tight tabular-nums ${
          hero ? "text-4xl sm:text-5xl" : "text-3xl"
        }`}
      >
        {error ? "–" : loading ? "…" : value}
      </p>
      {series && !loading && !error && <Sparkline values={series} hero={hero} />}
      {ratio && !loading && !error && <RatioBar part={ratio.part} total={ratio.total} />}
      <div className="mt-1.5 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">{error ?? meta ?? hint}</span>
        {variance && !loading && !error && <span className="text-muted-foreground/70">{variance.label}</span>}
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** 14-day micro area chart — data ink, no chrome. */
function Sparkline({ values, hero }: { values: number[]; hero?: boolean }) {
  const max = Math.max(...values, 1);
  const W = 240;
  const H = hero ? 56 : 36;
  const step = W / Math.max(values.length - 1, 1);
  const pts = values.map((t, i) => `${(i * step).toFixed(1)},${(H - (t / max) * (H - 4) - 2).toFixed(1)}`);
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`mt-2 w-full ${hero ? "h-14" : "h-9"}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill="var(--chart-4)" opacity="0.15" />
      <path d={line} fill="none" stroke="var(--chart-4)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Part-of-whole micro bar for KPIs with no time history (never invent trends). */
function RatioBar({ part, total }: { part: number; total: number }) {
  const share = total > 0 ? part / total : 0;
  return (
    <div
      className="mt-2.5 flex items-center gap-2"
      role="img"
      aria-label={`${part} of ${total} vendors flagged poor performers`}
    >
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-destructive/70"
          style={{ width: `${Math.max(share * 100, part > 0 ? 4 : 0)}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-muted-foreground">
        {part > 0 ? `${Math.round(share * 100)}%` : "none"}
      </span>
    </div>
  );
}

// -------------------------------------------------------------------- panels

/** Minimal Tremor-style bar chart: 7 daily GMV bars on a baseline rule. */
function GmvTrend({ orders, days: windowDays }: { orders: Order[]; days: number }) {
  const days = Array.from({ length: windowDays }, (_, i) =>
    nextDay(new Date().toISOString().slice(0, 10), i - (windowDays - 1)),
  );
  const totals = days.map((day) => ({
    day,
    total: orders.filter((o) => o.created_at.startsWith(day)).reduce((s, o) => s + o.totals.total_cents, 0),
  }));
  const max = Math.max(...totals.map((t) => t.total), 1);
  const fmtDay = (d: string) => {
    const date = new Date(`${d}T00:00:00Z`);
    return windowDays <= 7
      ? date.toLocaleDateString("en-NG", { weekday: "short" })
      : String(date.getUTCDate()).padStart(2, "0");
  };
  // Thin x-axis labels so 30/90-day windows don't turn into a smear.
  const showEvery = Math.ceil(windowDays / 7);
  const gapCls = windowDays > 14 ? "gap-px" : "gap-2";

  if (totals.every((t) => t.total === 0)) {
    return (
      <StateBlock
        variant="empty"
        title="No sales in this window"
        message={`No orders were placed in the last ${windowDays} days.`}
      />
    );
  }

  return (
    <div>
      {/* Peak gridline labels the scale so the plot doesn't read as empty space. */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="tabular-nums">{money(max)}</span>
        <span>peak</span>
      </div>
      <div className={`flex h-40 items-end border-b border-border ${gapCls}`}>
        {totals.map(({ day, total }) => (
          <div key={day} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[10px] font-medium whitespace-nowrap text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {total > 0 ? money(total) : "–"}
            </span>
            {/* Blue (chart-4) — the primary data series color; green is reserved
                for actions/active states, not for decorating data. */}
            <div
              className="w-full rounded-t-sm bg-chart-4/80 transition-all group-hover:bg-chart-4"
              style={{ height: `${Math.max((total / max) * 100, 2)}%` }}
              title={`${day}: ${money(total)}`}
            />
          </div>
        ))}
      </div>
      <div className={`mt-1.5 flex ${gapCls}`}>
        {totals.map(({ day }, idx) => (
          <span
            key={day}
            className={`flex-1 text-center text-[10px] text-muted-foreground ${
              idx % showEvery === 0 ? "" : "invisible"
            }`}
          >
            {fmtDay(day)}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Dispute lifecycle donut (UI Pro-style): thick rounded arcs with gaps,
 * dominant center total, hover tooltips, windowed to the last N days by
 * `opened_at`. Legend rows share the hover highlight with the arcs.
 */
function DisputeMix({ disputes, days }: { disputes: Dispute[]; days: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const slices = [
    { key: "OPEN", label: "Open", color: "var(--chart-2)" },
    { key: "UNDER_REVIEW", label: "Under review", color: "var(--chart-4)" },
    { key: "RESOLVED", label: "Resolved", color: "var(--chart-1)" },
    { key: "CLOSED_OUT", label: "Rejected / closed", color: "var(--muted-foreground)" },
  ];
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const windowed = disputes.filter((d) => d.opened_at >= cutoff);
  const counts = slices.map((s) => ({
    ...s,
    count: windowed.filter((d) =>
      s.key === "RESOLVED"
        ? d.status.startsWith("RESOLVED")
        : s.key === "CLOSED_OUT"
          ? d.status === "REJECTED" || d.status === "CLOSED"
          : d.status === s.key,
    ).length,
  }));
  const total = counts.reduce((s, c) => s + c.count, 0);

  if (total === 0) {
    return (
      <StateBlock
        variant="empty"
        title="No disputes in this window"
        message={`No disputes were opened in the last ${days} days.`}
      />
    );
  }

  // Donut math on a circumference of 100: round caps extend strokeWidth/2 past
  // each dash end, so the dash is shortened by gap + stroke to paint exactly
  // the slice minus one gap, centered.
  const R = 15.9155;
  const SW = 5; // viewBox units → ~21px arc at size-44
  const GAP = 1.4;

  let start = 0;
  const arcs = counts
    .filter((c) => c.count > 0)
    .map((c) => {
      const len = (c.count / total) * 100;
      const dash = Math.max(len - GAP - SW, 0.4);
      const offset = 25 - (start + GAP / 2 + SW / 2);
      start += len;
      const dimmed = hovered !== null && hovered !== c.key;
      return (
        <circle
          key={c.key}
          cx="21"
          cy="21"
          r={R}
          fill="none"
          stroke={c.color}
          strokeWidth={SW}
          strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(3)} ${(100 - dash).toFixed(3)}`}
          strokeDashoffset={offset}
          className="cursor-pointer transition-opacity duration-150"
          opacity={dimmed ? 0.3 : 1}
          onMouseEnter={() => setHovered(c.key)}
          onMouseLeave={() => setHovered(null)}
        />
      );
    });

  const hoveredSlice = counts.find((c) => c.key === hovered) ?? null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
      >
        <svg viewBox="0 0 42 42" className="size-44" role="img" aria-label="Dispute mix">
          <circle cx="21" cy="21" r={R} fill="none" stroke="var(--muted)" strokeWidth={SW} />
          {arcs}
        </svg>
        {/* HTML overlay: real DM Sans typography for the dominant center figure. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl leading-none font-semibold tracking-tight tabular-nums">
            {total}
          </span>
          <span className="mt-1 text-[10px] tracking-wide text-muted-foreground uppercase">
            disputes · {days}d
          </span>
        </div>
        {hoveredSlice && cursor && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[140%] rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: cursor.x, top: cursor.y }}
            role="status"
          >
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="size-2 rounded-full" style={{ backgroundColor: hoveredSlice.color }} />
              <span className="font-medium">{hoveredSlice.label}</span>
              <span className="text-muted-foreground">{hoveredSlice.count}</span>
              <span className="text-muted-foreground">({pct(hoveredSlice.count / total)})</span>
            </span>
          </div>
        )}
      </div>
      <ul className="w-full divide-y divide-border/60 text-xs">
        {counts.map((c) => (
          <li
            key={c.key}
            onMouseEnter={() => setHovered(c.key)}
            onMouseLeave={() => setHovered(null)}
            className={`flex items-center gap-2 px-1 py-1.5 transition-colors ${
              hovered === c.key ? "bg-muted/60" : ""
            }`}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
            <span className="truncate text-muted-foreground">{c.label}</span>
            <span className="ml-auto font-medium tabular-nums">{c.count}</span>
            <span className="w-10 text-right text-muted-foreground tabular-nums">
              {pct(c.count / total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vendors breaching thresholds, with their worst metric called out. */
function VendorWatchlist({ vendors, loading }: { vendors: Vendor[]; loading?: boolean }) {
  const poor = vendors.filter(
    (v) =>
      v.performance.cancellation_rate >= 0.1 ||
      v.performance.late_shipment_rate >= 0.15 ||
      v.performance.spoilage_complaints >= 20,
  );

  if (loading) return <StateBlock variant="loading" />;
  if (poor.length === 0)
    return (
      <StateBlock
        variant="empty"
        title="All vendors within thresholds"
        message="No vendor is breaching cancellation, late-shipment, or spoilage limits right now."
      />
    );

  return (
    <ul className="divide-y divide-border/60">
      {poor.map((v) => {
        const worst =
          v.performance.cancellation_rate >= 0.1
            ? { label: "cancellation", value: pct(v.performance.cancellation_rate) }
            : v.performance.late_shipment_rate >= 0.15
              ? { label: "late shipments", value: pct(v.performance.late_shipment_rate) }
              : { label: "spoilage complaints", value: String(v.performance.spoilage_complaints) };
        return (
          <li key={v.id}>
            <Link
              to="/vendors/$vendorId"
              params={{ vendorId: v.id }}
              className="flex items-center gap-3 px-1 py-2.5 transition-colors hover:bg-muted/40"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive dark:text-red-300">
                <AlertTriangleIcon size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{v.business_name}</p>
                <p className="text-xs text-muted-foreground">
                  {worst.label} at <span className="font-medium text-destructive">{worst.value}</span>
                </p>
              </div>
              <StatusBadge status={v.status} tone={VENDOR_STATUS_TONE[v.status] ?? "gray"} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Activity feed: latest audited mutations (roles with audit:read) merged
 * with recent listing decisions (visible to every role via listings:read),
 * newest first. Both sources are already audit-trailed by the mock.
 */
interface ListingDecision {
  kind: "listing";
  at: string;
  action: string;
  listingId: string;
  title: string;
  adminId: string;
}

interface AuditRow {
  kind: "audit";
  entry: AuditEntry;
}

function RecentActivity() {
  const { admin } = useAuth();
  const canReadAudit = admin?.role === "SUPER_ADMIN" || admin?.role === "FINANCE";
  const auditQuery = useQuery({
    queryKey: ["audit", "recent"],
    queryFn: () =>
      api.request<{ data: AuditEntry[] }>("GET", "/admin/v1/audit?limit=5", undefined, {
        token: currentToken(),
      }),
    enabled: canReadAudit,
  });
  const listingsQuery = useListings({});

  const decisions: ListingDecision[] = (listingsQuery.data?.data ?? [])
    .flatMap((l: Listing) =>
      l.review_history.map((r) => ({
        kind: "listing" as const,
        at: r.at,
        action: r.action,
        listingId: l.id,
        title: l.title,
        adminId: r.admin_id,
      })),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3);

  const auditRows: AuditRow[] = (auditQuery.data?.data ?? []).map((entry) => ({ kind: "audit" as const, entry }));
  const rows: (ListingDecision | AuditRow)[] = [...decisions, ...auditRows]
    .sort((a, b) => {
      const atA = a.kind === "listing" ? a.at : a.entry.at;
      const atB = b.kind === "listing" ? b.at : b.entry.at;
      return atB.localeCompare(atA);
    })
    .slice(0, 6);

  const loading = (canReadAudit && auditQuery.isLoading) || listingsQuery.isLoading;
  // Hero stat: how many of the shown entries happened today.
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayCount = rows.filter((r) => (r.kind === "listing" ? r.at : r.entry.at).startsWith(todayIso)).length;
  const error =
    canReadAudit && auditQuery.isError
      ? apiErrorMessage(auditQuery.error)
      : listingsQuery.isError
        ? apiErrorMessage(listingsQuery.error)
        : null;

  return (
    <Panel
      title="Recent activity"
      subtitle={<span>Listing decisions + latest <Term k="audit">audited</Term> mutations</span>}
      stat={{ value: String(todayCount), caption: "today" }}
    >
      {error ? (
        <StateBlock
          variant="error"
          message={error}
          onRetry={() => {
            if (canReadAudit && auditQuery.isError) void auditQuery.refetch();
            if (listingsQuery.isError) void listingsQuery.refetch();
          }}
          retrying={auditQuery.isFetching || listingsQuery.isFetching}
        />
      ) : loading ? (
        <StateBlock variant="loading" />
      ) : rows.length === 0 ? (
        <StateBlock
          variant="empty"
          title="No activity yet"
          message="Listing decisions and audited changes will appear here as they happen."
        />
      ) : (
        <>
          <ul className="divide-y divide-border/60">
            {rows.map((row) =>
              row.kind === "listing" ? (
                <li key={`lst-${row.listingId}-${row.at}`} className="flex items-start gap-2.5 py-2 text-sm">
                  <span
                    className={`mt-1 size-1.5 shrink-0 rounded-full ${
                      row.action === "APPROVED"
                        ? "bg-success"
                        : row.action === "REJECTED"
                          ? "bg-destructive"
                          : "bg-muted-foreground"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="font-medium">{row.action.toLowerCase()}</span>{" "}
                      <Link
                        to="/listings/$listingId"
                        params={{ listingId: row.listingId }}
                        className="text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {row.title}
                      </Link>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {adminName(row.adminId)} · {dateTime(row.at)}
                    </p>
                  </div>
                </li>
              ) : (
                <li key={row.entry.id} className="flex items-start gap-2.5 py-2 text-sm">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="font-medium">{row.entry.action}</span>{" "}
                      <span className="text-muted-foreground">
                        on {row.entry.entity_type.toLowerCase()} {row.entry.entity_id.slice(-6).toUpperCase()}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {adminName(row.entry.actor_admin_id)} · {dateTime(row.entry.at)}
                    </p>
                  </div>
                </li>
              ),
            )}
          </ul>
          <Link to="/audit" className="mt-2 block text-xs text-primary underline">
            Full audit log
          </Link>
        </>
      )}
    </Panel>
  );
}
