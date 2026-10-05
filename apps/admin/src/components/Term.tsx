/**
 * Glossary tooltip: plain-language explanations for domain jargon, inline
 * where the term is used. Dotted underline + focusable button; shows on
 * hover AND keyboard focus (no click needed, blur dismisses). Zero
 * dependencies — position is measured and viewport-clamped so scroll
 * containers (the shell's <main>) can never clip it.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The glossary: term key → plain-language explanation. UI copy guide, §5. */
export const GLOSSARY: Record<string, { term: string; definition: string }> = {
  gmv: {
    term: "Sales volume (GMV)",
    definition:
      "Gross Merchandise Value: the total value of orders placed, before refunds or commission. It measures marketplace activity, not profit.",
  },
  sla: {
    term: "Response deadline (SLA)",
    definition:
      "Service Level Agreement: the promised time window for an action, e.g. ship within 24 hours or answer a dispute within 12. 'Overdue' means the window has passed.",
  },
  escalation: {
    term: "Escalation",
    definition:
      "The deadline was missed by a wide margin, so the case is flagged for management attention on top of the normal queue.",
  },
  kyc: {
    term: "Identity check (KYC)",
    definition:
      "Know Your Customer: verifying a vendor's legal identity and bank details before they can sell. Required before a vendor is approved.",
  },
  walletCredit: {
    term: "Wallet credit",
    definition:
      "Refunding by adding money to the customer's GrowBox wallet instead of their bank card. Instant for the customer; cheaper to process than a card refund.",
  },
  partialReconciliation: {
    term: "Partial reconciliation",
    definition:
      "Split resolution: the customer is compensated for only part of the disputed amount, used when fault is shared or partially disproven.",
  },
  override: {
    term: "Status override",
    definition:
      "A manual change of an order's lifecycle status by an admin, skipping the normal vendor flow. Every override is mandatory-audited with a reason.",
  },
  idempotency: {
    term: "Idempotency key",
    definition:
      "A unique tag attached to a money operation. If the request is retried (bad network, double click), the backend recognises the tag and never pays out twice.",
  },
  threePl: {
    term: "Courier (3PL)",
    definition:
      "Third-Party Logistics: the external delivery company that ships an order. Assigning one records the tracking reference against the order.",
  },
  takeRate: {
    term: "Take rate",
    definition:
      "GrowBox's commission as a percentage of order value. The marketplace's core revenue metric.",
  },
  audit: {
    term: "Audit trail",
    definition:
      "An append-only record of every admin mutation: who did it, what changed, before/after values, and why. Cannot be edited or deleted by anyone.",
  },
};

export type GlossaryKey = keyof typeof GLOSSARY;

/** Gap between trigger and tooltip edge. */
const GAP = 6;
/** Viewport edge inset so the tooltip never touches the screen edge. */
const MARGIN = 8;

interface TipPos {
  left: number;
  top: number;
  /** True when flipped below the trigger (no room above). */
  below: boolean;
  /** Arrow x-offset relative to the tooltip, kept pointing at the trigger. */
  arrowX: number;
}

/**
 * Inline jargon term with a hover/focus tooltip. Render children (or the
 * canonical term) as a dotted-underlined trigger.
 */
export function Term({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  const entry = GLOSSARY[k];
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  /** Viewport coords; null = hidden. Also gates first paint so the tooltip
   * never flashes at an unmeasured position. */
  const [pos, setPos] = useState<TipPos | null>(null);
  /** Hover and focus tracked separately so a stray mouse-out doesn't hide a
   * tooltip the keyboard user is still focused on (and vice versa). */
  const hoverRef = useRef(false);
  const focusRef = useRef(false);

  /** Measure trigger + tooltip, clamp into the viewport, flip below if the
   * trigger sits too close to the top edge. */
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;
    const r = trigger.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const maxLeft = Math.max(MARGIN, window.innerWidth - w - MARGIN);
    const left = Math.min(Math.max(r.left + (r.width - w) / 2, MARGIN), maxLeft);
    const below = r.top - h - GAP < MARGIN;
    const rawTop = below ? r.bottom + GAP : r.top - h - GAP;
    // Clamp both edges: the trigger can scroll fully above the viewport, in
    // which case even the below-flip would land off-screen.
    const maxTop = Math.max(MARGIN, window.innerHeight - h - MARGIN);
    const top = Math.min(Math.max(rawTop, MARGIN), maxTop);
    const arrowX = Math.min(Math.max(r.left + r.width / 2 - left, 12), w - 12);
    const next = { left, top, below, arrowX };
    // Bail out on identical geometry so the rAF loop doesn't re-render every
    // frame while nothing is actually moving.
    setPos((prev) =>
      prev &&
      prev.left === next.left &&
      prev.top === next.top &&
      prev.below === next.below &&
      prev.arrowX === next.arrowX
        ? prev
        : next,
    );
  }, []);

  const sync = () => {
    if (hoverRef.current || focusRef.current) place();
    else setPos(null);
  };

  // Follow the trigger while open: <main> scrolls independently of the
  // window and layout can resize (drawer, breakpoint). Scroll/resize listeners
  // cover the common moves; a rAF loop additionally catches layout shifts and
  // self-throttles when the window is hidden.
  const isOpen = pos !== null;
  useEffect(() => {
    if (!isOpen) return;
    const move = () => place();
    window.addEventListener("scroll", move, true);
    window.addEventListener("resize", move);
    let raf = requestAnimationFrame(function tick() {
      place();
      raf = requestAnimationFrame(tick);
    });
    return () => {
      window.removeEventListener("scroll", move, true);
      window.removeEventListener("resize", move);
      cancelAnimationFrame(raf);
    };
  }, [isOpen, place]);

  if (!entry) return <>{children}</>;

  return (
    <span
      className="group relative inline-block"
      onPointerEnter={() => {
        hoverRef.current = true;
        sync();
      }}
      onPointerLeave={() => {
        hoverRef.current = false;
        sync();
      }}
      onFocus={() => {
        focusRef.current = true;
        sync();
      }}
      onBlur={() => {
        focusRef.current = false;
        sync();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="cursor-help border-b border-dotted border-muted-foreground/60 font-medium text-foreground"
        aria-describedby={`glossary-${k}`}
        onClick={(e) => e.preventDefault()}
      >
        {children ?? entry.term}
      </button>
      <span
        ref={tipRef}
        id={`glossary-${k}`}
        role="tooltip"
        style={pos ? { left: pos.left, top: pos.top } : undefined}
        className={cn(
          "pointer-events-none fixed z-50 w-64 rounded-lg border border-border bg-popover p-2.5 text-xs font-normal leading-relaxed text-popover-foreground shadow-xl transition-opacity",
          pos ? "visible opacity-100" : "invisible opacity-0",
        )}
      >
        {entry.definition}
        <span
          className={cn(
            "absolute size-2 -translate-x-1/2 rotate-45 border-border bg-popover",
            pos?.below ? "-top-1 border-t border-l" : "-bottom-1 border-b border-r",
          )}
          style={pos ? { left: pos.arrowX } : undefined}
        />
      </span>
    </span>
  );
}
