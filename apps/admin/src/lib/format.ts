/**
 * Formatting helpers shared by the admin screens.
 * Amounts are integer cents everywhere (openapi/admin-v1.yaml note); the
 * currency/locale for display is deployment config — see lib/currency.ts
 * (VITE_CURRENCY_CODE / VITE_LOCALE, defaulting to NGN/en-NG).
 */

export { money } from "./currency";

export function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
