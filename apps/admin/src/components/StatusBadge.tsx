/**
 * Status badges: one visual language for every §5 state machine.
 * Green = healthy/terminal-good, amber = attention, red = money-loss/bad,
 * gray = inert/terminal-neutral, blue = in-progress.
 */

import { cn } from "@/lib/utils";

/* Every text/background pair below is measured ≥4.5:1 (WCAG AA, small text)
 * on card, page background and muted row-hover surfaces in BOTH themes —
 * see scripts/contrast-audit.mjs. Foreground tokens (`*-foreground`) are
 * designed for SOLID fills, so tints pair with explicit palette colours
 * instead; blue uses chart-4 (the project blue) because no --info token
 * exists and --accent is amber. */
const TONES = {
  green: "bg-success/15 text-green-900 dark:text-emerald-300 ring-1 ring-success/40",
  // Ring at 30% (not 40%): the gold outline was the loudest element on dark
  // cards; toned down to keep amber attention-grabbing without glowing.
  amber: "bg-warning/15 text-warning-foreground dark:text-amber-200 ring-1 ring-warning/30",
  red: "bg-destructive/15 text-red-900 dark:text-red-300 ring-1 ring-destructive/40",
  blue: "bg-chart-4/15 text-blue-900 dark:text-blue-300 ring-1 ring-chart-4/40",
  gray: "bg-muted text-muted-foreground ring-1 ring-border",
} as const;

export type Tone = keyof typeof TONES;

export const ORDER_STATUS_TONE: Record<string, Tone> = {
  PLACED: "blue",
  ACCEPTED: "blue",
  PACKED: "blue",
  SHIPPED: "green",
  DELIVERED: "green",
  CANCELLED: "gray",
  REFUNDED: "red",
};

export const DISPUTE_STATUS_TONE: Record<string, Tone> = {
  OPEN: "amber",
  UNDER_REVIEW: "blue",
  RESOLVED_REFUND: "red",
  RESOLVED_CREDIT: "amber",
  RESOLVED_PARTIAL_RECON: "amber",
  REJECTED: "gray",
  CLOSED: "gray",
};

export const VENDOR_STATUS_TONE: Record<string, Tone> = {
  PENDING_KYC: "gray",
  KYC_REVIEW: "amber",
  APPROVED: "green",
  SUSPENDED: "red",
  BANNED: "red",
};

export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string;
  tone: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
