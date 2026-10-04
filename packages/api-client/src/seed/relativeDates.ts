/**
 * Time-relative seeding.
 *
 * The demo fixtures were originally written with hardcoded mid-September
 * dates, which meant "sales today" read ₦0 and every SLA timer looked like
 * ancient history the day after the files were authored. This module shifts
 * every seed timestamp by a single offset so the newest business event lands
 * exactly at module-load time — the demo always shows a fresh week of
 * activity and breached SLAs stay urgent.
 *
 * Mechanics: `shift()` rewrites any ISO string by a fixed millisecond
 * offset, preserving intra-day ordering (the offset is identical for every
 * timestamp, so before/after relationships in the audit trail are intact).
 */

/** The most recent seeded event lands exactly at module-load time (today). */
const NEWEST_SEED_DATE = "2026-09-08T17:42:00Z"; // latest timestamp across all seed files

/** Milliseconds to ADD to each literal seed date to re-base it to now. */
const OFFSET_MS = Date.now() - new Date(NEWEST_SEED_DATE).getTime();

/** Shift an ISO timestamp by the seed offset, returning an ISO string. */
export function shift(iso: string): string {
  return new Date(new Date(iso).getTime() + OFFSET_MS).toISOString();
}
