/**
 * The UI historically used friendlier enum spellings than the FastAPI backend
 * (e.g. "yearly" vs the stored "annual"). Writes are translated by
 * `api/enumAdapters.ts`, but reads pass through unchanged — so live data carries
 * the backend's canonical value while a few constant lists still carry the UI
 * alias. That split makes filters that compare a constant to the data silently
 * miss (a "Yearly" option never matches an "annual" row).
 *
 * `canonicalEnum` collapses every known alias to the one backend value, so the
 * same concept can only appear once. Use it wherever an enum value is compared,
 * grouped, or shown — matching stays correct no matter which spelling a row has.
 */
const CANONICAL: Record<string, string> = {
  // Billing cycle
  bi_monthly: 'bimonthly',
  yearly: 'annual',
  // Premium frequency ("yearly" handled above too)
  // Policy status
  cancelled: 'surrendered',
  // Payment method
  net_banking: 'bank_transfer',
  credit_card: 'card',
  debit_card: 'card',
  auto_debit: 'bank_transfer',
};

export function canonicalEnum<T extends string | null | undefined>(value: T): T {
  if (value == null || value === '') return value;
  return (CANONICAL[value] ?? value) as T;
}
