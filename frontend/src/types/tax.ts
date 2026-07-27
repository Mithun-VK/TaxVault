export type TaxType =
  | 'property_tax'
  | 'land_tax'
  | 'water_tax'
  | 'professional_tax'
  | 'income_tax'
  | 'vehicle_tax'
  | 'gst'
  | 'other';

export type TaxStatus = 'pending' | 'paid' | 'overdue' | 'exempt';

export interface Tax {
  id: string;
  /** Display label shown on the calendar / payments / reports. Falls back to description. */
  name?: string | null;
  tax_type: TaxType;
  /** Assessment / property / consumer number issued by the authority. */
  tax_number?: string | null;
  description: string;
  linked_asset_id?: string | null;
  /** Personal taxes (income tax etc.) link to a person instead of a property. */
  individual_id?: string | null;
  linked_asset_name?: string | null;
  assessment_year: string;
  total_amount: number;
  due_date: string;
  status: TaxStatus;
  paid_date?: string | null;
  receipt_document_id?: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface TaxCreate {
  name?: string;
  tax_type: TaxType;
  tax_number?: string;
  description: string;
  linked_asset_id?: string | null;
  /** Personal taxes (income tax etc.) link to a person instead of a property. */
  individual_id?: string | null;
  assessment_year: string;
  total_amount: number;
  due_date: string;
  notes?: string;
}

export type TaxUpdate = Partial<TaxCreate> & { status?: TaxStatus };

export interface TaxFilters {
  search?: string;
  tax_type?: TaxType | 'all';
  status?: TaxStatus | 'all';
  assessment_year?: string | 'all';
}
