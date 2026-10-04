/**
 * Marketing fixtures — promotions across the full §6 lifecycle (DRAFT,
 * SCHEDULED, LIVE, ENDED) and notifications in each broadcast status.
 *
 * Windows are written as literal dates around the shared seed reference date
 * and re-based to "now" by `shift()`, so a demo always shows one campaign
 * live right now, one queued to open soon, one still drafting, and one that
 * already ran. Notification bodies and coupon codes are fictional.
 */
import type { components } from "@growbox/api-client";
import { shift } from "./relativeDates";

export type Promotion = components["schemas"]["Promotion"];
export type Notification = components["schemas"]["Notification"];

const OWNER = "adm_01J9Z8Q0000000000000000001"; // SUPER_ADMIN
const OPS = "adm_01J9Z8Q0000000000000000002"; // OPS

const RAW_PROMOTIONS: Promotion[] = [
  {
    id: "pro_01J9Z8Q0000000000000000001",
    code: "HARVEST20",
    type: "PERCENT",
    value: 20,
    scope: "GLOBAL",
    starts_at: "2026-09-01T00:00:00Z",
    ends_at: "2026-09-20T23:59:00Z",
    usage_limit: 5000,
    used_count: 1842,
    status: "LIVE",
    created_by_admin_id: OPS,
    created_at: "2026-08-28T09:00:00Z",
  },
  {
    id: "pro_01J9Z8Q0000000000000000002",
    code: "FREESHIPNL",
    type: "FREE_SHIPPING",
    value: 0,
    scope: "CATEGORY",
    scope_ref: "leafy-greens",
    starts_at: "2026-09-14T00:00:00Z",
    ends_at: "2026-09-28T23:59:00Z",
    usage_limit: 2000,
    used_count: 0,
    status: "SCHEDULED",
    created_by_admin_id: OPS,
    created_at: "2026-09-05T11:30:00Z",
  },
  {
    id: "pro_01J9Z8Q0000000000000000003",
    code: "YAMS500",
    type: "FIXED",
    value: 50000, // ₦500 off
    scope: "VENDOR",
    scope_ref: "ven_01J9Z8Q00000000000000000A3",
    starts_at: "2026-09-22T00:00:00Z",
    ends_at: "2026-10-06T23:59:00Z",
    usage_limit: 300,
    used_count: 0,
    status: "DRAFT",
    created_by_admin_id: OWNER,
    created_at: "2026-09-07T15:45:00Z",
  },
  {
    id: "pro_01J9Z8Q0000000000000000004",
    code: "EARLYBIRD",
    type: "PERCENT",
    value: 15,
    scope: "GLOBAL",
    starts_at: "2026-08-01T00:00:00Z",
    ends_at: "2026-08-15T23:59:00Z",
    usage_limit: 1000,
    used_count: 967,
    status: "ENDED",
    created_by_admin_id: OPS,
    created_at: "2026-07-25T10:00:00Z",
  },
];

const RAW_NOTIFICATIONS: Notification[] = [
  {
    id: "ntf_01J9Z8Q0000000000000000001",
    audience: "BUYERS",
    title: "Harvest week is on: 20% off leafy greens",
    body: "Use code HARVEST20 at checkout before Sunday. Fresh stock from Oyo Highlands and Jos Plateau.",
    status: "SENT",
    sent_at: "2026-09-01T08:00:00Z",
    created_by_admin_id: OPS,
    created_at: "2026-08-31T16:20:00Z",
  },
  {
    id: "ntf_01J9Z8Q0000000000000000002",
    audience: "VENDORS",
    title: "September payout batch closes Friday",
    body: "Submit your invoices before 17:00 WAT to be included in this cycle. Late submissions move to the next batch.",
    status: "SCHEDULED",
    scheduled_at: "2026-09-10T09:00:00Z",
    created_by_admin_id: OWNER,
    created_at: "2026-09-06T12:00:00Z",
  },
  {
    id: "ntf_01J9Z8Q0000000000000000003",
    audience: "SEGMENT",
    title: "Delivery delay in the North-West corridor",
    body: "Flooding on the Kaduna road is adding a day to deliveries. We are contacting affected orders directly.",
    status: "DRAFT",
    created_by_admin_id: OPS,
    created_at: "2026-09-08T07:15:00Z",
  },
];

export const PROMOTIONS: Promotion[] = RAW_PROMOTIONS.map((p) => ({
  ...p,
  starts_at: shift(p.starts_at),
  ends_at: shift(p.ends_at),
  created_at: shift(p.created_at),
}));

export const NOTIFICATIONS: Notification[] = RAW_NOTIFICATIONS.map((n) => ({
  ...n,
  created_at: shift(n.created_at),
  ...(n.scheduled_at ? { scheduled_at: shift(n.scheduled_at) } : {}),
  ...(n.sent_at ? { sent_at: shift(n.sent_at) } : {}),
}));
