/**
 * Payout domain types — now owned by the OpenAPI contract (openapi/admin-v1.yaml,
 * "payouts" block) and generated into `generated/schema.d.ts`. This module stays
 * only as a stable import path, so call sites never reach into `generated/` and
 * ADR-002's "the contract is the source of truth" rule holds for payouts too.
 *
 * Money convention: every amount is integer minor units (kobo), ₦1 = 100 kobo.
 * `net_cents` always equals gross_cents − commission_cents; the calculate
 * endpoint derives all three from the order ledger and rejects any batch where
 * that invariant (or a caller's claimed amounts) fails.
 */
import type { components } from "./generated/schema";

export type PayoutStatus = components["schemas"]["PayoutStatus"];
export type PayoutDecision = components["schemas"]["PayoutDecision"];
export type Payout = components["schemas"]["Payout"];
export type PayoutPage = components["schemas"]["PayoutPage"];
