/**
 * Disputes — every category (SPOILAGE, DAMAGE, WRONG_ITEM, NOT_DELIVERED,
 * OTHER) and every lifecycle branch (OPEN, UNDER_REVIEW, RESOLVED_REFUND,
 * RESOLVED_CREDIT, RESOLVED_PARTIAL_RECON, REJECTED, CLOSED).
 */
import type { components } from "@growbox/api-client";
import { shift } from "./relativeDates";

export type Dispute = components["schemas"]["Dispute"];

/** Written with literal dates, re-based to "now" at load (see relativeDates). */
const RAW_DISPUTES: Dispute[] = [
  {
    id: "dsp_01K5M2F00000000000000000D1",
    order_id: "ord_01K5M2F0000000000000000002", // the SLA-breached order
    opened_by: "CUSTOMER",
    category: "NOT_DELIVERED",
    status: "OPEN",
    description: "Order accepted over 24h ago, never shipped; customer chased twice.",
    amount_disputed_cents: 8100000,
    opened_at: "2026-09-08T10:00:00Z",
    comments: [],
    sla: { type: "UNANSWERED_DISPUTE", threshold_hours: 12, breached: true, breached_at: "2026-09-08T22:00:00Z", escalated: true },
  },
  {
    id: "dsp_01K5M2F00000000000000000D2",
    order_id: "ord_01K5M2F0000000000000000005",
    opened_by: "CUSTOMER",
    category: "SPOILAGE",
    status: "OPEN",
    description: "Half the green amaranth arrived wilted and smelling off; photos attached in the buyer app.",
    amount_disputed_cents: 4400000,
    opened_at: "2026-09-05T18:30:00Z",
    comments: [
      {
        id: "cmt_01K5M2F0000000000000000X1",
        author_admin_id: "adm_01J9Z8Q0000000000000000004",
        body: "Requested vendor response; photos look consistent with cold-chain failure.",
        at: "2026-09-06T09:00:00Z",
      },
    ],
    sla: { type: "UNANSWERED_DISPUTE", threshold_hours: 12, breached: true, breached_at: "2026-09-06T06:30:00Z", escalated: false },
  },
  {
    id: "dsp_01K5M2F00000000000000000D3",
    order_id: "ord_01K5M2F0000000000000000004",
    opened_by: "VENDOR",
    category: "DAMAGE",
    status: "UNDER_REVIEW",
    description: "Vendor claims courier crushed the avocado (pear) crates in transit; wants damage split.",
    amount_disputed_cents: 16500000,
    opened_at: "2026-09-07T08:00:00Z",
    comments: [
      {
        id: "cmt_01K5M2F0000000000000000X2",
        author_admin_id: "adm_01J9Z8Q0000000000000000002",
        body: "Checking Kwik Delivery handling logs before deciding.",
        at: "2026-09-07T10:15:00Z",
      },
    ],
    sla: { type: "UNANSWERED_DISPUTE", threshold_hours: 12, breached: false, escalated: false },
  },
  {
    id: "dsp_01K5M2F00000000000000000D4",
    order_id: "ord_01K5M2F0000000000000000007",
    opened_by: "CUSTOMER",
    category: "SPOILAGE",
    status: "RESOLVED_REFUND",
    description: "Entire delivery spoiled on arrival.",
    amount_disputed_cents: 10400000,
    opened_at: "2026-08-31T12:00:00Z",
    resolution: {
      type: "REFUND",
      amount_cents: 104000,
      admin_id: "adm_01J9Z8Q0000000000000000003",
      notes: "Full refund to original payment method; vendor notified.",
      at: "2026-09-01T15:20:00Z",
    },
    comments: [],
  },
  {
    id: "dsp_01K5M2F00000000000000000D5",
    order_id: "ord_01K5M2F0000000000000000006",
    opened_by: "CUSTOMER",
    category: "OTHER",
    status: "RESOLVED_CREDIT",
    description: "Order cancelled after vendor suspension; customer chose wallet credit.",
    amount_disputed_cents: 30500000,
    opened_at: "2026-09-03T11:30:00Z",
    resolution: {
      type: "WALLET_CREDIT",
      amount_cents: 305000,
      admin_id: "adm_01J9Z8Q0000000000000000002",
      notes: "Credited to GrowBox wallet for next purchase.",
      at: "2026-09-03T16:00:00Z",
    },
    comments: [],
  },
  {
    id: "dsp_01K5M2F00000000000000000D6",
    order_id: "ord_01K5M2F0000000000000000005",
    opened_by: "CUSTOMER",
    category: "WRONG_ITEM",
    status: "RESOLVED_PARTIAL_RECON",
    description: "Received scent leaf instead of half the amaranth quantity.",
    amount_disputed_cents: 2200000,
    opened_at: "2026-09-05T13:00:00Z",
    resolution: {
      type: "PARTIAL",        amount_cents: 1100000,
      admin_id: "adm_01J9Z8Q0000000000000000004",
      notes: "Vendor accepted fault for half the substitution value.",
      at: "2026-09-05T17:45:00Z",
    },
    comments: [],
  },
  {
    id: "dsp_01K5M2F00000000000000000D7",
    order_id: "ord_01K5M2F0000000000000000004",
    opened_by: "CUSTOMER",
    category: "DAMAGE",
    status: "REJECTED",
    description: "Claimed bruised avocados; delivery photos show intact crates.",
    amount_disputed_cents: 5000000,
    opened_at: "2026-09-06T19:00:00Z",
    resolution: {
      type: "REFUND",
      amount_cents: 0,
      admin_id: "adm_01J9Z8Q0000000000000000002",
      notes: "Evidence contradicts the claim; rejected.",
      at: "2026-09-07T09:30:00Z",
    },
    comments: [],
  },
  {
    id: "dsp_01K5M2F00000000000000000D8",
    order_id: "ord_01K5M2F0000000000000000005",
    opened_by: "CUSTOMER",
    category: "NOT_DELIVERED",
    status: "CLOSED",
    description: "Reported late delivery; parcel arrived during the wait.",
    amount_disputed_cents: 10350000,
    opened_at: "2026-09-05T08:00:00Z",
    resolution: {
      type: "REFUND",
      amount_cents: 0,
      admin_id: "adm_01J9Z8Q0000000000000000004",
      notes: "Resolved by delivery; closed automatically.",
      at: "2026-09-05T12:10:00Z",
    },
    comments: [],
  },
];

export const DISPUTES: Dispute[] = RAW_DISPUTES.map((d) => ({
  ...d,
  opened_at: shift(d.opened_at),
  sla: d.sla
    ? { ...d.sla, ...(d.sla.breached_at ? { breached_at: shift(d.sla.breached_at) } : {}) }
    : undefined,
  resolution: d.resolution
    ? { ...d.resolution, at: shift(d.resolution.at) }
    : undefined,
  comments: d.comments.map((c) => ({ ...c, at: shift(c.at) })),
}));

export const DISPUTE_BY_ID = new Map(DISPUTES.map((d) => [d.id, d]));
