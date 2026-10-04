/**
 * Orders — every §5 status covered (PLACED, ACCEPTED, PACKED, SHIPPED,
 * DELIVERED, CANCELLED, REFUNDED), including: stuck orders, a breached SLA,
 * an admin override in history, 3PL-assigned orders, and plain healthy ones.
 * Amounts are integer cents (see openapi/admin-v1.yaml note) — for the NGN
 * market, kobo: ₦1 = 100 kobo. Values scaled to realistic Nigerian grocery
 * order sizes (₦8,000–₦35,000 basket).
 */
import type { components } from "@growbox/api-client";
import { shift } from "./relativeDates";

export type Order = components["schemas"]["Order"];

const V_OYO = "ven_01J9Z8Q00000000000000000A1"; // APPROVED, healthy
const V_JOS = "ven_01J9Z8Q00000000000000000A2"; // APPROVED, warning
const V_ZARIA = "ven_01J9Z8Q00000000000000000A5"; // SUSPENDED — orders predate it

/** Written with literal dates, re-based to "now" at load (see relativeDates). */
const RAW_ORDERS: Order[] = [
  {
    id: "ord_01K5M2F0000000000000000001",
    customer: { id: "cus_01K5M2F0000000000000C0001", name: "Chinedu Okafor" },
    vendor_id: V_OYO,
    vendor_name: "Oyo Highlands Produce",
    items: [
      { listing_id: "lst_01K5M2F0000000000000L0001", name: "Ugwu (Fluted Pumpkin)", quantity_kg: 5, unit_price_cents: 1200000, total_cents: 6000000 },
      { listing_id: "lst_01K5M2F0000000000000L0002", name: "Tomatoes (Plum)", quantity_kg: 8, unit_price_cents: 1500000, total_cents: 12000000 },
    ],
    totals: { subtotal_cents: 18000000, delivery_fee_cents: 2500000, discount_cents: 0, total_cents: 20500000, commission_amount_cents: 1025000 },
    status: "PLACED",
    created_at: "2026-09-08T17:42:00Z",
    updated_at: "2026-09-08T17:42:00Z",
    admin_overrides: [],
    sla: { type: "UNSHIPPED", threshold_hours: 24, breached: false, escalated: false },
  },
  {
    id: "ord_01K5M2F0000000000000000002",
    customer: { id: "cus_01K5M2F0000000000000C0002", name: "Funmilayo Adeleke" },
    vendor_id: V_JOS,
    vendor_name: "Jos Plateau Greens",
    items: [
      { listing_id: "lst_01K5M2F0000000000000L0003", name: "Green Amaranth", quantity_kg: 6, unit_price_cents: 1100000, total_cents: 6600000 },
    ],
    totals: { subtotal_cents: 6600000, delivery_fee_cents: 2500000, discount_cents: 1000000, total_cents: 8100000, commission_amount_cents: 405000 },
    status: "ACCEPTED",
    created_at: "2026-09-07T09:15:00Z",
    updated_at: "2026-09-07T09:40:00Z",
    admin_overrides: [],
    sla: { type: "UNSHIPPED", threshold_hours: 24, breached: true, breached_at: "2026-09-08T09:40:00Z", escalated: true },
  },
  {
    id: "ord_01K5M2F0000000000000000003",
    customer: { id: "cus_01K5M2F0000000000000C0003", name: "Kelechi Ndukwe" },
    vendor_id: V_OYO,
    vendor_name: "Oyo Highlands Produce",
    items: [
      { listing_id: "lst_01K5M2F0000000000000L0004", name: "Carrots (Jos)", quantity_kg: 10, unit_price_cents: 900000, total_cents: 9000000 },
      { listing_id: "lst_01K5M2F0000000000000L0005", name: "Red Onions", quantity_kg: 12, unit_price_cents: 850000, total_cents: 10200000 },
    ],
    totals: { subtotal_cents: 19200000, delivery_fee_cents: 2500000, discount_cents: 0, total_cents: 21700000, commission_amount_cents: 1085000 },
    status: "PACKED",
    created_at: "2026-09-07T14:05:00Z",
    updated_at: "2026-09-07T16:30:00Z",
    admin_overrides: [],
    sla: { type: "UNSHIPPED", threshold_hours: 24, breached: false, escalated: false },
  },
  {
    id: "ord_01K5M2F0000000000000000004",
    customer: { id: "cus_01K5M2F0000000000000C0004", name: "Halima Suleiman" },
    vendor_id: V_OYO,
    vendor_name: "Oyo Highlands Produce",
    items: [
      { listing_id: "lst_01K5M2F0000000000000L0006", name: "Avocado (Pear)", quantity_kg: 15, unit_price_cents: 2200000, total_cents: 33000000 },
    ],
    totals: { subtotal_cents: 33000000, delivery_fee_cents: 3500000, discount_cents: 0, total_cents: 36500000, commission_amount_cents: 1825000 },
    status: "SHIPPED",
    created_at: "2026-09-06T08:20:00Z",
    updated_at: "2026-09-06T13:45:00Z",
    admin_overrides: [],
    assigned_logistics: { provider: "Kwik Delivery", tracking_ref: "KWIK-88120-LA", at: "2026-09-06T13:45:00Z" },
    sla: { type: "UNSHIPPED", threshold_hours: 24, breached: false, escalated: false },
  },
  {
    id: "ord_01K5M2F0000000000000000005",
    customer: { id: "cus_01K5M2F0000000000000C0005", name: "Ngozi Eneh" },
    vendor_id: V_JOS,
    vendor_name: "Jos Plateau Greens",
    items: [
      { listing_id: "lst_01K5M2F0000000000000L0003", name: "Green Amaranth", quantity_kg: 4, unit_price_cents: 1100000, total_cents: 4400000 },
      { listing_id: "lst_01K5M2F0000000000000L0007", name: "Scent Leaf", quantity_kg: 3, unit_price_cents: 1150000, total_cents: 3450000 },
    ],
    totals: { subtotal_cents: 7850000, delivery_fee_cents: 2500000, discount_cents: 0, total_cents: 10350000, commission_amount_cents: 517500 },
    status: "DELIVERED",
    created_at: "2026-09-04T10:00:00Z",
    updated_at: "2026-09-05T12:10:00Z",
    admin_overrides: [],
    assigned_logistics: { provider: "GIGL Fresh", tracking_ref: "GIGL-40512-AB", at: "2026-09-04T15:00:00Z" },
    sla: { type: "UNSHIPPED", threshold_hours: 24, breached: false, escalated: false },
  },
  {
    id: "ord_01K5M2F0000000000000000006",
    customer: { id: "cus_01K5M2F0000000000000C0006", name: "Yusuf Garba" },
    vendor_id: V_ZARIA,
    vendor_name: "Zaria Onion Collective",
    items: [
      { listing_id: "lst_01K5M2F0000000000000L0008", name: "Onions (Red)", quantity_kg: 50, unit_price_cents: 550000, total_cents: 27500000 },
    ],
    totals: { subtotal_cents: 27500000, delivery_fee_cents: 4000000, discount_cents: 0, total_cents: 31500000, commission_amount_cents: 1575000 },
    status: "CANCELLED",
    created_at: "2026-09-02T09:00:00Z",
    updated_at: "2026-09-03T11:00:00Z",
    admin_overrides: [
      {
        admin_id: "adm_01J9Z8Q0000000000000000002",
        from: "PLACED",
        to: "CANCELLED",
        reason: "Vendor suspended before packing; buyer refunded via wallet.",
        at: "2026-09-03T11:00:00Z",
      },
    ],
    sla: { type: "UNSHIPPED", threshold_hours: 24, breached: false, escalated: false },
  },
  {
    id: "ord_01K5M2F0000000000000000007",
    customer: { id: "cus_01K5M2F0000000000000C0007", name: "Blessing Igwe" },
    vendor_id: V_OYO,
    vendor_name: "Oyo Highlands Produce",
    items: [
      { listing_id: "lst_01K5M2F0000000000000L0001", name: "Ugwu (Fluted Pumpkin)", quantity_kg: 7, unit_price_cents: 1200000, total_cents: 8400000 },
    ],
    totals: { subtotal_cents: 8400000, delivery_fee_cents: 2500000, discount_cents: 0, total_cents: 10900000, commission_amount_cents: 545000 },
    status: "REFUNDED",
    created_at: "2026-08-30T09:30:00Z",
    updated_at: "2026-09-01T15:20:00Z",
    admin_overrides: [
      {
        admin_id: "adm_01J9Z8Q0000000000000000003",
        from: "DELIVERED",
        to: "REFUNDED",
        reason: "Spoiled on arrival; dispute resolved as full refund.",
        at: "2026-09-01T15:20:00Z",
      },
    ],
    assigned_logistics: { provider: "ColdHubs Logistics", tracking_ref: "CHUB-22145-IB", at: "2026-08-30T14:00:00Z" },
    sla: { type: "UNSHIPPED", threshold_hours: 24, breached: false, escalated: false },
  },
];

export const ORDERS: Order[] = RAW_ORDERS.map((o) => ({
  ...o,
  created_at: shift(o.created_at),
  updated_at: shift(o.updated_at),
  sla: {
    ...o.sla,
    ...(o.sla.breached_at ? { breached_at: shift(o.sla.breached_at) } : {}),
  },
  admin_overrides: o.admin_overrides.map((ov) => ({ ...ov, at: shift(ov.at) })),
  assigned_logistics: o.assigned_logistics
    ? { ...o.assigned_logistics, at: shift(o.assigned_logistics.at) }
    : undefined,
}));

export const ORDER_BY_ID = new Map(ORDERS.map((o) => [o.id, o]));
