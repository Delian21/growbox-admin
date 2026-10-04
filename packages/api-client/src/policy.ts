/**
 * Shared policy: state machines (ARCHITECTURE.md §5) and the RBAC matrix (§9).
 *
 * Pure TypeScript — no MSW, no I/O. Imported by the mock handlers AND the UI
 * (nav hiding / action gating) so both sides agree on the rules. The real
 * backend must re-implement these server-side; this module is the spec of
 * what it enforces, and the client side is UX only (§2).
 */

import type { components } from "./generated/schema";
import type { ListingStatus } from "./listing-types";
import type { PayoutStatus } from "./payout-types";

export type { Listing, ListingPage, ListingStatus } from "./listing-types";
export type { Payout, PayoutPage, PayoutStatus } from "./payout-types";
export type PromotionStatus = NonNullable<components["schemas"]["Promotion"]>["status"];
export type NotificationStatus = NonNullable<components["schemas"]["Notification"]>["status"];
export type Role = NonNullable<components["schemas"]["AdminUser"]>["role"];
export type OrderStatus = NonNullable<components["schemas"]["OrderStatusOverride"]>["to"];
export type DisputeStatus = NonNullable<components["schemas"]["Dispute"]>["status"];
export type VendorStatus = NonNullable<components["schemas"]["Vendor"]>["status"];

/** §5 order machine. CANCELLED only before shipping; REFUNDED only after. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

/** §5 dispute machine. Terminal only at CLOSED; REJECTED also closes out. */
export const DISPUTE_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  OPEN: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["RESOLVED_REFUND", "RESOLVED_CREDIT", "RESOLVED_PARTIAL_RECON", "REJECTED"],
  RESOLVED_REFUND: ["CLOSED"],
  RESOLVED_CREDIT: ["CLOSED"],
  RESOLVED_PARTIAL_RECON: ["CLOSED"],
  REJECTED: ["CLOSED"],
  CLOSED: [],
};

/** §5 vendor machine: BANNED is reversible to APPROVED per §5. */
export const VENDOR_TRANSITIONS: Record<VendorStatus, VendorStatus[]> = {
  PENDING_KYC: ["KYC_REVIEW"],
  KYC_REVIEW: ["APPROVED"],
  APPROVED: ["SUSPENDED", "BANNED"],
  SUSPENDED: ["APPROVED", "BANNED"],
  BANNED: ["APPROVED"],
};

/**
 * Listing approval machine (approval-queue extension). DRAFT never enters
 * the admin queue — vendors submit it (DRAFT → PENDING_REVIEW); admins only
 * decide on PENDING_REVIEW and may archive live/rejected listings.
 */
export const LISTING_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  DRAFT: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["ARCHIVED"],
  REJECTED: ["ARCHIVED", "PENDING_REVIEW"],
  ARCHIVED: [],
};

/**
 * Payout batch machine (§5): CALCULATED → PENDING_APPROVAL → APPROVED →
 * PAID, with FAILED reachable from APPROVED (bank transfer rejected) and
 * retryable back to PENDING_APPROVAL. Submitting a calculated batch and
 * retrying a failed one are admin actions, both reason-audited.
 */
export const PAYOUT_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  CALCULATED: ["PENDING_APPROVAL"],
  PENDING_APPROVAL: ["APPROVED"],
  APPROVED: ["PAID", "FAILED"],
  PAID: [],
  FAILED: ["PENDING_APPROVAL"],
};

/**
 * Promotion lifecycle (§6): DRAFT → SCHEDULED → LIVE → ENDED. An admin may
 * end a SCHEDULED or LIVE campaign early; DRAFT has no exit other than
 * scheduling it, and ENDED is terminal.
 */
export const PROMO_TRANSITIONS: Record<PromotionStatus, PromotionStatus[]> = {
  DRAFT: ["SCHEDULED"],
  SCHEDULED: ["LIVE", "ENDED"],
  LIVE: ["ENDED"],
  ENDED: [],
};

/** One entry per admin operation that exists in the Phase 1 contract. */
export type AdminOperation =
  | "orders:read"
  | "orders:override-status"
  | "orders:assign-logistics"
  | "disputes:read"
  | "disputes:comment"
  | "disputes:start-review"
  | "disputes:resolve"
  | "vendors:read"
  | "vendors:kyc-review"
  | "vendors:warn"
  | "vendors:suspend"
  | "vendors:reinstate"
  |  "vendors:ban"
  | "listings:read"
  | "listings:approve"
  | "listings:reject"
  | "payouts:read"
  | "payouts:calculate"
  | "payouts:submit"
  | "payouts:approve"
  | "payouts:mark-paid"
  | "payouts:retry"
  | "promotions:read"
  | "promotions:create"
  | "promotions:schedule"
  | "promotions:end"
  | "notifications:read"
  | "notifications:create"
  | "notifications:send"
  | "analytics:read"
  | "audit:read";

/**
 * §9 RBAC matrix. SUPER_ADMIN has every permission by definition (checked
 * first in `can`). Lists the operations each non-super role may perform.
 */
export const RBAC_MATRIX: Record<Exclude<Role, "SUPER_ADMIN">, AdminOperation[]> = {
  OPS: [
    "orders:read",
    "orders:override-status",
    "orders:assign-logistics",
    "disputes:read",
    "disputes:comment",
    "disputes:start-review",
    "disputes:resolve",
    "vendors:read",
    "vendors:kyc-review",
    "vendors:warn",
    "vendors:suspend",
    "vendors:reinstate",
    "vendors:ban",
    "listings:read",
    "listings:approve",
    "listings:reject",
    "payouts:read",
    "promotions:read",
    "promotions:create",
    "promotions:schedule",
    "promotions:end",
    "notifications:read",
    "notifications:create",
    "notifications:send",
    "analytics:read",
  ],
  FINANCE: [
    "orders:read",
    "disputes:read",
    "vendors:read",
    "listings:read",
    "payouts:read",
    "payouts:calculate",
    "payouts:submit",
    "payouts:approve",
    "payouts:mark-paid",
    "payouts:retry",
    "analytics:read",
    "audit:read",
  ],
  SUPPORT: ["orders:read", "disputes:read", "disputes:comment", "vendors:read", "listings:read"],
};

export function can(role: Role, op: AdminOperation): boolean {
  if (role === "SUPER_ADMIN") return true;
  return RBAC_MATRIX[role]?.includes(op) ?? false;
}
