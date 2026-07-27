// The mock data layer and the real FastAPI backend use slightly different
// enum string values for a handful of fields. These helpers translate the
// UI-friendly (mock) value to whatever the real backend expects on the way
// out, and normalize the backend's value to a UI-known literal on the way in.
// Both directions are additive casts — every value the backend can return is
// already part of the corresponding frontend union (see types/*.ts).

const BILLING_CYCLE_TO_BACKEND: Record<string, string> = {
  bi_monthly: 'bimonthly',
  // The backend's BillCycle now supports annual, and existing rows use 'annual'
  // (it previously downgraded yearly -> quarterly, which silently lost data).
  yearly: 'annual',
};

export function toBackendBillingCycle(value: string): string {
  return BILLING_CYCLE_TO_BACKEND[value] ?? value;
}

// The backend's TaxType enum now includes vehicle_tax/gst (stored in a plain
// String column), so every UI tax category round-trips as-is.
export function toBackendTaxType(value: string): string {
  return value;
}

// The backend's BillType enum now includes dth/subscription/dubai (stored in a
// plain String column), so every UI bill category round-trips as-is.
export function toBackendBillType(value: string): string {
  return value;
}

// The backend's InsuranceType enum now includes health/term (stored in a plain
// String column), so every UI insurance category round-trips as-is.
export function toBackendInsuranceType(value: string): string {
  return value;
}

const PREMIUM_FREQUENCY_TO_BACKEND: Record<string, string> = {
  yearly: 'annual',
};

export function toBackendPremiumFrequency(value: string): string {
  return PREMIUM_FREQUENCY_TO_BACKEND[value] ?? value;
}

const POLICY_STATUS_TO_BACKEND: Record<string, string> = {
  cancelled: 'surrendered',
};

export function toBackendPolicyStatus(value: string): string {
  return POLICY_STATUS_TO_BACKEND[value] ?? value;
}

const PAYMENT_METHOD_TO_BACKEND: Record<string, string> = {
  net_banking: 'bank_transfer',
  credit_card: 'card',
  debit_card: 'card',
  auto_debit: 'bank_transfer',
};

export function toBackendPaymentMethod(value: string | undefined): string | undefined {
  if (!value) return value;
  return PAYMENT_METHOD_TO_BACKEND[value] ?? value;
}
