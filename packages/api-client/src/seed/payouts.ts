/**
 * Payout batches — vendor settlement runs flowing through the §5 machine
 * (CALCULATED → PENDING_APPROVAL → APPROVED → PAID, with FAILED retry).
 * Fictional Nigerian produce vendors consistent with the roster; vendor_id
 * references VENDORS in vendors.ts. Extends the Phase 1 contract (see
 * payout-types.ts). Covers every lifecycle state plus a FAILED batch.
 */
import type { Payout } from "../payout-types";
import { shift } from "./relativeDates";

/** Written with literal dates, re-based to "now" at load (see relativeDates). */
const RAW_PAYOUTS: Payout[] = [
  {
    id: "pay_01K5P8Q00000000000000000P1",
    vendor_id: "ven_01J9Z8Q00000000000000000A1", // Oyo Highlands Produce
    period_start: "2026-09-01",
    period_end: "2026-09-07",
    gross_cents: 18465000, // ₦184,650
    commission_cents: 1846500, // ₦18,465 (10%)
    net_cents: 16618500, // ₦166,185
    orders_count: 23,
    status: "PENDING_APPROVAL",
    decision_history: [
      {
        action: "SUBMITTED",
        admin_id: "adm_01J9Z8Q0000000000000000002",
        reason: "Weekly settlement run for week 36; totals reconciled against the order ledger.",
        at: "2026-09-08T09:10:00Z",
      },
    ],
  },
  {
    id: "pay_01K5P8Q00000000000000000P2",
    vendor_id: "ven_01J9Z8Q00000000000000000A2", // Jos Plateau Greens
    period_start: "2026-09-01",
    period_end: "2026-09-07",
    gross_cents: 14230000, // ₦142,300
    commission_cents: 1423000,
    net_cents: 12807000, // ₦128,070
    orders_count: 19,
    status: "PENDING_APPROVAL",
    decision_history: [
      {
        action: "SUBMITTED",
        admin_id: "adm_01J9Z8Q0000000000000000002",
        reason: "Weekly settlement run for week 36; totals reconciled against the order ledger.",
        at: "2026-09-08T09:12:00Z",
      },
    ],
  },
  {
    id: "pay_01K5P8Q00000000000000000P3",
    vendor_id: "ven_01J9Z8Q00000000000000000A3", // Benue Yam & Tubers Co.
    period_start: "2026-09-01",
    period_end: "2026-09-07",
    gross_cents: 9880000, // ₦98,800
    commission_cents: 988000,
    net_cents: 8892000, // ₦88,920
    orders_count: 12,
    status: "CALCULATED",
    decision_history: [],
  },
  {
    id: "pay_01K5P8Q00000000000000000P4",
    vendor_id: "ven_01J9Z8Q00000000000000000A4", // Epe Leafy Farms
    period_start: "2026-09-01",
    period_end: "2026-09-07",
    gross_cents: 7650000, // ₦76,500
    commission_cents: 765000,
    net_cents: 6885000, // ₦68,850
    orders_count: 9,
    status: "APPROVED",
    approved_by_admin_id: "adm_01J9Z8Q0000000000000000003",
    approved_at: "2026-09-08T11:30:00Z",
    decision_history: [
      {
        action: "SUBMITTED",
        admin_id: "adm_01J9Z8Q0000000000000000002",
        reason: "Weekly settlement run for week 36; totals reconciled against the order ledger.",
        at: "2026-09-08T09:14:00Z",
      },
      {
        action: "APPROVED",
        admin_id: "adm_01J9Z8Q0000000000000000003",
        reason: "Figures match the finance ledger; cleared for transfer.",
        at: "2026-09-08T11:30:00Z",
      },
    ],
  },
  {
    id: "pay_01K5P8Q00000000000000000P5",
    vendor_id: "ven_01J9Z8Q00000000000000000A7", // Ogbomosho Mango Hub
    period_start: "2026-08-25",
    period_end: "2026-08-31",
    gross_cents: 21740000, // ₦217,400
    commission_cents: 2174000,
    net_cents: 19566000, // ₦195,660
    orders_count: 27,
    status: "PAID",
    approved_by_admin_id: "adm_01J9Z8Q0000000000000000003",
    approved_at: "2026-09-01T10:00:00Z",
    paid_at: "2026-09-02T14:45:00Z",
    decision_history: [
      {
        action: "SUBMITTED",
        admin_id: "adm_01J9Z8Q0000000000000000002",
        reason: "August week 35 settlement; totals reconciled against the order ledger.",
        at: "2026-09-01T09:20:00Z",
      },
      {
        action: "APPROVED",
        admin_id: "adm_01J9Z8Q0000000000000000003",
        reason: "Reconciled with the bank file; approved.",
        at: "2026-09-01T10:00:00Z",
      },
      {
        action: "PAID",
        admin_id: "adm_01J9Z8Q0000000000000000003",
        reason: "Transfer confirmed by the bank (ref GTB-88213).",
        at: "2026-09-02T14:45:00Z",
      },
    ],
  },
  {
    id: "pay_01K5P8Q00000000000000000P6",
    vendor_id: "ven_01J9Z8Q00000000000000000A6", // Niger Delta Fresh Exports (banned)
    period_start: "2026-08-25",
    period_end: "2026-08-31",
    gross_cents: 5420000, // ₦54,200
    commission_cents: 542000,
    net_cents: 4878000, // ₦48,780
    orders_count: 6,
    status: "FAILED",
    failure_reason: "Beneficiary account is on the compliance hold list (vendor banned).",
    approved_by_admin_id: "adm_01J9Z8Q0000000000000000003",
    approved_at: "2026-09-01T10:05:00Z",
    decision_history: [
      {
        action: "SUBMITTED",
        admin_id: "adm_01J9Z8Q0000000000000000002",
        reason: "August week 35 settlement; totals reconciled against the order ledger.",
        at: "2026-09-01T09:22:00Z",
      },
      {
        action: "APPROVED",
        admin_id: "adm_01J9Z8Q0000000000000000003",
        reason: "Reconciled with the bank file; approved.",
        at: "2026-09-01T10:05:00Z",
      },
      {
        action: "RETRY",
        admin_id: "adm_01J9Z8Q0000000000000000003",
        reason: "Bank rejected the transfer (compliance hold). Returned to the approval queue pending compliance review.",
        at: "2026-09-03T09:40:00Z",
      },
    ],
  },
  {
    id: "pay_01K5P8Q00000000000000000P7",
    vendor_id: "ven_01J9Z8Q00000000000000000A5", // Zaria Onion Collective (suspended)
    period_start: "2026-08-25",
    period_end: "2026-08-31",
    gross_cents: 3310000, // ₦33,100
    commission_cents: 331000,
    net_cents: 2979000, // ₦29,790
    orders_count: 4,
    status: "CALCULATED",
    decision_history: [],
  },
];

export const PAYOUTS: Payout[] = RAW_PAYOUTS.map((p) => ({
  ...p,
  decision_history: p.decision_history.map((d) => ({ ...d, at: shift(d.at) })),
  ...(p.approved_at ? { approved_at: shift(p.approved_at) } : {}),
  ...(p.paid_at ? { paid_at: shift(p.paid_at) } : {}),
}));

export const PAYOUT_BY_ID = new Map(PAYOUTS.map((p) => [p.id, p]));
