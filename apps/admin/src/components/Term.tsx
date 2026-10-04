/**
 * Glossary tooltip: plain-language explanations for domain jargon, inline
 * where the term is used. Dotted underline + focusable button; shows on
 * hover AND keyboard focus (no click needed, Esc/blur dismisses). Zero
 * dependencies — CSS group-hover/focus-within.
 */
import type { ReactNode } from "react";

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

/**
 * Inline jargon term with a hover/focus tooltip. Render children (or the
 * canonical term) as a dotted-underlined trigger.
 */
export function Term({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  const entry = GLOSSARY[k];
  if (!entry) return <>{children}</>;
  return (
    <span className="group relative inline-block">
      <button
        type="button"
        className="cursor-help border-b border-dotted border-muted-foreground/60 font-medium text-foreground"
        aria-describedby={`glossary-${k}`}
        onClick={(e) => e.preventDefault()}
      >
        {children ?? entry.term}
      </button>
      <span
        id={`glossary-${k}`}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-1.5 w-64 -translate-x-1/2 rounded-lg border border-border bg-popover p-2.5 text-xs font-normal leading-relaxed text-popover-foreground opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {entry.definition}
        <span className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 border-b border-r border-border bg-popover" />
      </span>
    </span>
  );
}
