/**
 * Listing domain types — now owned by the OpenAPI contract (openapi/admin-v1.yaml,
 * "listings" block) and generated into `generated/schema.d.ts`. This module stays
 * only as a stable import path, so call sites never reach into `generated/` and
 * ADR-002's "the contract is the source of truth" rule holds for listings too.
 */
import type { components } from "./generated/schema";

export type ListingStatus = components["schemas"]["ListingStatus"];
export type ListingReviewEntry = components["schemas"]["ListingReviewEntry"];
export type ListingComment = components["schemas"]["ListingComment"];
export type Listing = components["schemas"]["Listing"];
export type ListingPage = components["schemas"]["ListingPage"];
