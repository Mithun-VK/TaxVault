export type InsuranceType =
  | 'life'
  | 'term'
  | 'health'
  | 'medical'
  | 'vehicle'
  | 'property'
  | 'other';

// 'annual' is the real backend's value; 'yearly' is the mock/UI value.
export type PremiumFrequency = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'annual';

// 'surrendered' is the real backend's value; 'cancelled' is the mock/UI value.
export type PolicyStatus = 'active' | 'lapsed' | 'matured' | 'cancelled' | 'surrendered';

export type PremiumStatus = 'paid' | 'upcoming' | 'overdue';

export interface PremiumScheduleItem {
  id: string;
  due_date: string;
  amount: number;
  status: PremiumStatus;
  paid_date?: string | null;
}

export interface InsuranceClaim {
  id: string;
  claim_number: string;
  date: string;
  amount: number;
  status: 'filed' | 'approved' | 'rejected' | 'settled';
  description: string;
}

export interface InsurancePolicy {
  id: string;
  /** Display label shown on the calendar / payments / reports. Falls back to "provider · policy". */
  name?: string | null;
  policy_number: string;
  provider: string;
  insurance_type: InsuranceType;
  // null means "not specified" - distinct from a policy with zero coverage.
  sum_insured: number | null;
  premium_amount: number;
  premium_frequency: PremiumFrequency;
  start_date: string;
  end_date: string;
  next_premium_date: string;
  status: PolicyStatus;
  linked_asset_id?: string | null;
  linked_individual_id?: string | null;
  nominee?: string;
  notes: string;
  schedule: PremiumScheduleItem[];
  claims: InsuranceClaim[];
  created_at: string;
  updated_at: string;
}

export interface InsuranceCreate {
  name?: string;
  policy_number: string;
  provider: string;
  insurance_type: InsuranceType;
  sum_insured: number;
  premium_amount: number;
  premium_frequency: PremiumFrequency;
  start_date: string;
  end_date: string;
  next_premium_date: string;
  linked_asset_id?: string | null;
  linked_individual_id?: string | null;
  nominee?: string;
  notes?: string;
}

export type InsuranceUpdate = Partial<InsuranceCreate> & { status?: PolicyStatus };

export interface InsuranceFilters {
  search?: string;
  insurance_type?: InsuranceType | 'all';
  status?: PolicyStatus | 'all';
}
