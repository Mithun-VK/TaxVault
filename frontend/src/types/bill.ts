/** Categories that ship with the app. */
export type KnownBillType = 'phone' | 'electricity' | 'wifi' | 'dth' | 'dubai' | 'other';

/**
 * A bill's category. Users can add their own, so any slug is valid — the
 * `(string & {})` keeps autocomplete for the known ones while allowing custom.
 */
export type BillType = KnownBillType | (string & {});

// 'bimonthly' is the real backend's value; 'bi_monthly' is the mock/UI value.
// 'annual' is what existing rows use; 'yearly' is its alias.
export type BillingCycle =
  | 'monthly'
  | 'bi_monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'yearly'
  | 'annual';

export type BillStatus = 'pending' | 'paid' | 'overdue';

export interface Bill {
  id: string;
  /** Display label shown on the calendar / payments / reports. Falls back to provider_name. */
  name?: string | null;
  bill_type: BillType;
  provider_name: string;
  account_number: string;
  average_amount: number;
  billing_cycle: BillingCycle;
  next_due_date: string;
  status: BillStatus;
  auto_pay: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface BillCreate {
  name?: string;
  bill_type: BillType;
  provider_name: string;
  account_number: string;
  average_amount: number;
  billing_cycle: BillingCycle;
  next_due_date: string;
  auto_pay?: boolean;
  notes?: string;
}

export type BillUpdate = Partial<BillCreate> & { status?: BillStatus };

export interface BillFilters {
  search?: string;
  bill_type?: BillType | 'all';
  status?: BillStatus | 'all';
}
