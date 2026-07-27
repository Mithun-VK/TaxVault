import type { PayableEntityType } from './payment';

export interface PayableReportRow {
  entity_id: string;
  entity_name: string;
  entity_type: PayableEntityType;
  subtype?: string | null;
  // month number (1-12) -> total paid that month. JSON object keys arrive as
  // strings, so index with the numeric month (JS coerces to string).
  months: Record<string, number>;
  total: number;
}

export interface PayablesReport {
  year: number;
  entity_type: string;
  rows: PayableReportRow[];
}

export interface AssetRegisterRow {
  id: string;
  name: string;
  asset_type: string;
  status: string;
  acquisition_date: string | null;
  acquisition_cost: number | null;
  current_value: number | null;
  taxes_paid: number;
  premiums_paid: number;
}

export interface AssetRegisterReport {
  rows: AssetRegisterRow[];
}
