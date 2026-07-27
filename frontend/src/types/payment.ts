export type PayableEntityType = 'tax' | 'insurance' | 'bill';

export type PaymentEntityType = PayableEntityType | 'asset';

export type PaymentMethod =
  | 'upi'
  | 'net_banking'
  | 'bank_transfer'
  | 'credit_card'
  | 'debit_card'
  | 'card'
  | 'cash'
  | 'cheque'
  | 'auto_debit';

export interface Payment {
  id: string;
  entity_type: PaymentEntityType;
  entity_id: string;
  entity_name: string;
  amount_paid: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number?: string;
  period?: string | null;
  receipt_document_id?: string | null;
  notes: string;
  created_at: string;
}

export interface PaymentCreate {
  entity_type: PaymentEntityType;
  entity_id: string;
  entity_name: string;
  amount_paid: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number?: string;
  period?: string;
  receipt_document_id?: string | null;
  notes?: string;
}

export interface PaymentFilters {
  entity_type?: PaymentEntityType | 'all';
  payment_method?: PaymentMethod | 'all';
  date_from?: string;
  date_to?: string;
}

export interface PaymentSummary {
  total_this_month: number;
  total_this_fy: number;
}
