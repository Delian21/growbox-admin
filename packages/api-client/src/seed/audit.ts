/**
 * Audit log — pre-populated so the Audit Log screen has history from the
 * first run, including entries that correspond to seeded overrides,
 * resolutions, warnings, and vendor actions. Newest first.
 */
import type { components } from "@growbox/api-client";
import { shift } from "./relativeDates";

export type AuditLog = components["schemas"]["AuditLog"];

/** Written with literal dates, re-based to "now" at load (see relativeDates). */
const RAW_AUDIT_LOG: AuditLog[] = [
  {
    id: "aud_01K5M2F0000000000000000A01",
    actor_admin_id: "adm_01J9Z8Q0000000000000000003",
    action: "order.status-override",
    entity_type: "ORDER",
    entity_id: "ord_01K5M2F0000000000000000007",
    before: { status: "DELIVERED" },
    after: { status: "REFUNDED" },
    reason: "Spoiled on arrival; dispute resolved as full refund.",
    ip: "10.20.0.11",
    at: "2026-09-01T15:20:00Z",
  },
  {
    id: "aud_01K5M2F0000000000000000A02",
    actor_admin_id: "adm_01J9Z8Q0000000000000000003",
    action: "dispute.resolve",
    entity_type: "DISPUTE",
    entity_id: "dsp_01K5M2F00000000000000000D4",
    before: { status: "UNDER_REVIEW" },
    after: { status: "RESOLVED_REFUND", amount_cents: 10400000 },
    reason: "Full refund to original payment method; vendor notified.",
    ip: "10.20.0.11",
    at: "2026-09-01T15:20:00Z",
  },
  {
    id: "aud_01K5M2F0000000000000000A03",
    actor_admin_id: "adm_01J9Z8Q0000000000000000002",
    action: "vendor.suspend",
    entity_type: "VENDOR",
    entity_id: "ven_01J9Z8Q00000000000000000A5",
    before: { status: "APPROVED" },
    after: { status: "SUSPENDED" },
    reason: "Cancellation rate 19% and spoilage complaints 38/mo after final warning.",
    ip: "10.20.0.12",
    at: "2026-08-20T10:00:00Z",
  },
  {
    id: "aud_01K5M2F0000000000000000A04",
    actor_admin_id: "adm_01J9Z8Q0000000000000000001",
    action: "vendor.warn",
    entity_type: "VENDOR",
    entity_id: "ven_01J9Z8Q00000000000000000A5",
    before: { warning_count: 1 },
    after: { warning_count: 2 },
    reason: "Spoilage complaints above 25/month; final warning before suspension.",
    ip: "10.20.0.10",
    at: "2026-08-18T14:00:00Z",
  },
  {
    id: "aud_01K5M2F0000000000000000A05",
    actor_admin_id: "adm_01J9Z8Q0000000000000000002",
    action: "dispute.resolve",
    entity_type: "DISPUTE",
    entity_id: "dsp_01K5M2F00000000000000000D5",
    before: { status: "OPEN" },
    after: { status: "RESOLVED_CREDIT", amount_cents: 30500000 },
    reason: "Credited to GrowBox wallet for next purchase.",
    ip: "10.20.0.12",
    at: "2026-09-03T16:00:00Z",
  },
  {
    id: "aud_01K5M2F0000000000000000A06",
    actor_admin_id: "adm_01J9Z8Q0000000000000000002",
    action: "order.status-override",
    entity_type: "ORDER",
    entity_id: "ord_01K5M2F0000000000000000006",
    before: { status: "PLACED" },
    after: { status: "CANCELLED" },
    reason: "Vendor suspended before packing; buyer refunded via wallet.",
    ip: "10.20.0.12",
    at: "2026-09-03T11:00:00Z",
  },
  {
    id: "aud_01K5M2F0000000000000000A07",
    actor_admin_id: "adm_01J9Z8Q0000000000000000001",
    action: "vendor.ban",
    entity_type: "VENDOR",
    entity_id: "ven_01J9Z8Q00000000000000000A6",
    before: { status: "SUSPENDED" },
    after: { status: "BANNED" },
    reason: "Repeatedly listed produce not matching delivered goods; escalation after ban review.",
    ip: "10.20.0.10",
    at: "2026-07-19T09:30:00Z",
  },
  {
    id: "aud_01K5M2F0000000000000000A08",
    actor_admin_id: "adm_01J9Z8Q0000000000000000004",
    action: "dispute.comment",
    entity_type: "DISPUTE",
    entity_id: "dsp_01K5M2F00000000000000000D2",
    before: null,
    after: { comment_added: true },
    reason: "Requested vendor response; photos look consistent with cold-chain failure.",
    ip: "10.20.0.13",
    at: "2026-09-06T09:00:00Z",
  },
];

export const AUDIT_LOG = RAW_AUDIT_LOG.map((e) => ({ ...e, at: shift(e.at) }));
