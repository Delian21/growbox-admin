/**
 * Admin display-name resolution. The API contract stores actor references as
 * admin IDs (`adm_…`); the UI renders names for accountability — "Aisha Bello
 * approved this payout" beats "adm_01J9Z8Q0…003 did". Uses the shared seed
 * registry (single source of admin identities); unknown IDs degrade to the
 * raw ID so audit data never renders blank.
 */
import { ADMIN_BY_ID } from "@growbox/api-client";

export function adminName(adminId: string): string {
  return ADMIN_BY_ID.get(adminId)?.name ?? adminId;
}

/** Short form for dense chips: first name + surname initial, e.g. "Ngozi O." */
export function adminShortName(adminId: string): string {
  const name = adminName(adminId);
  if (name === adminId) return name;
  const parts = name.split(" ");
  const last = parts[parts.length - 1];
  return parts.length > 1 && last ? `${parts[0]} ${last[0]}.` : name;
}
