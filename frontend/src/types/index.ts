export type TaxType = 'income_tax' | 'land_tax' | 'advance_tax' | 'gst' | 'professional_tax' | 'vehicle_tax' | 'other';

export type ObligationStatus = 'pending' | 'overdue' | 'paid' | 'exempt';

export type RecurrenceRule = 'NONE' | 'ANNUAL' | 'QUARTERLY' | 'MONTHLY';

export type AlertChannel = 'email' | 'sms' | 'push';

export type DocumentCategory = 'income_tax' | 'property' | 'gst' | 'vehicle' | 'other';

export interface Obligation {
  id: string;
  tax_type: TaxType;
  description: string;
  assessment_year: string;
  jurisdiction?: string;
  total_amount: number;
  due_date: string;
  recurrence_rule: RecurrenceRule;
  notes?: string;
  status: ObligationStatus;
  is_archived: boolean;
  alert_configured?: boolean;
}

export interface Payment {
  id: string;
  obligation_id: string;
  amount_paid: number;
  payment_date: string;
  reference_number?: string;
  notes?: string;
  receipt_url?: string;
  receipt_filename?: string;
}

export interface Document {
  id: string;
  label: string;
  category: DocumentCategory;
  financial_year?: string;
  tags: string[];
  file_size_kb: number;
  upload_date: string;
  file_type: 'pdf' | 'image' | 'doc';
  download_url: string;
  is_attachment: boolean;
  attached_to_id?: string;
  attached_to_name?: string;
}

export interface AlertConfig {
  id: string;
  obligation_id: string;
  channels: AlertChannel[];
  thresholds: number[]; // e.g. [30, 15, 7, 3, 1]
  is_active: boolean;
}

export interface AlertLog {
  id: string;
  obligation_id: string;
  channel: AlertChannel;
  timestamp: string;
  status: 'sent' | 'failed';
  message: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
}
