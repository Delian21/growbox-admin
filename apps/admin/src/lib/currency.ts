/**
 * Currency display configuration.
 *
 * Amounts are integer minor units (cents) end-to-end — this module only
 * decides how they are *rendered*. The market currency is a deployment
 * concern, not a code constant: GrowBox's demo fixtures happen to model
 * Kenya, but a Nigerian deployment should see ₦ without anyone touching
 * the formatter. Values come from Vite env vars (baked at build time):
 *
 *   VITE_CURRENCY_CODE — ISO 4217 code, e.g. NGN, KES, GHS (default: NGN)
 *   VITE_LOCALE        — BCP 47 locale, e.g. en-NG (default: en-NG)
 *
 * Both default to Nigeria. Set them per deployment, e.g. KES/en-KE for the
 * Kenyan demo dataset, and symbol/grouping come straight from Intl.
 */

const CURRENCY_CODE = import.meta.env.VITE_CURRENCY_CODE ?? "NGN";
const LOCALE = import.meta.env.VITE_LOCALE ?? "en-NG";

const formatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY_CODE,
  maximumFractionDigits: 0,
});

export function money(cents: number): string {
  return formatter.format(cents / 100);
}
