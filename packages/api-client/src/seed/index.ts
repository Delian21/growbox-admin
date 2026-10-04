/**
 * Seed index + reset helpers.
 *
 * The MSW handlers (phase 3) deep-copy these arrays at startup and mutate
 * only their working copy — `resetSeed()` restores the pristine fixture set,
 * which is what makes demo runs repeatable.
 */
export * from "./admins";
export * from "./vendors";
export * from "./orders";
export * from "./disputes";
export * from "./audit";
export * from "./listings";
export * from "./payouts";
export * from "./promotions";

import { ADMINS } from "./admins";
import { VENDORS } from "./vendors";
import { ORDERS } from "./orders";
import { DISPUTES } from "./disputes";
import { AUDIT_LOG } from "./audit";
import { LISTINGS } from "./listings";
import { PAYOUTS } from "./payouts";
import { NOTIFICATIONS, PROMOTIONS } from "./promotions";

export function seedSnapshot() {
  return {
    admins: structuredClone(ADMINS),
    vendors: structuredClone(VENDORS),
    orders: structuredClone(ORDERS),
    disputes: structuredClone(DISPUTES),
    audit: structuredClone(AUDIT_LOG),
    listings: structuredClone(LISTINGS),
    payouts: structuredClone(PAYOUTS),
    promotions: structuredClone(PROMOTIONS),
    notifications: structuredClone(NOTIFICATIONS),
  };
}

export type SeedState = ReturnType<typeof seedSnapshot>;

/** Fresh, deep-copied working state — call instead of mutating seed arrays. */
export function resetSeed(): SeedState {
  return seedSnapshot();
}
