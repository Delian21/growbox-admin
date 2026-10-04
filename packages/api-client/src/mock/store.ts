/**
 * Mock working state: a deep copy of the seed fixtures plus auth sessions and
 * the idempotency replay cache. Handlers mutate ONLY this store, never the
 * seed arrays — `resetStore()` restores the pristine demo dataset.
 */

import type { components } from "../generated/schema";
import { resetSeed } from "../seed";

type AdminUser = components["schemas"]["AdminUser"];

export interface MockSession {
  mfaToken: string;
  admin: AdminUser;
  issuedAt: number;
  expiresAt: number;
  /** Demo convenience: any 6–8 char code verifies. */
}

export const SESSION_TTL_MS = 30 * 60 * 1000; // short-lived sessions per §9

const seed = resetSeed();

export const store = {
  admins: seed.admins,
  vendors: seed.vendors,
  orders: seed.orders,
  disputes: seed.disputes,
  audit: seed.audit,
  listings: seed.listings,
  payouts: seed.payouts,
  promotions: seed.promotions,
  notifications: seed.notifications,

  sessions: new Map<string, MockSession>(),
  /** idempotencyKey → serialized dispute response (money-op replay, §5). */
  idempotencyCache: new Map<string, string>(),
};

export function resetStore(): void {
  const fresh = resetSeed();
  store.admins = fresh.admins;
  store.vendors = fresh.vendors;
  store.orders = fresh.orders;
  store.disputes = fresh.disputes;
  store.audit = fresh.audit;
  store.listings = fresh.listings;
  store.payouts = fresh.payouts;
  store.promotions = fresh.promotions;
  store.notifications = fresh.notifications;
  store.sessions.clear();
  store.idempotencyCache.clear();
}

/** Simulated client IP for the audit trail. */
export function ipFor(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "203.0.113.7" // TEST-NET-3 documentation IP
  );
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}
