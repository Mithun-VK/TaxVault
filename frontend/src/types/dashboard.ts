import type { PayableEntityType } from './payment';

export interface DashboardStats {
  total_asset_value: number;
  due_this_month: number;
  overdue_amount: number;
  overdue_count: number;
  paid_this_fy: number;
}

export interface UpcomingDeadline {
  id: string;
  entity_type: PayableEntityType;
  entity_id: string;
  name: string;
  amount: number;
  due_date: string;
  status: string;
}

export type ActivityAction =
  | 'payment_logged'
  | 'asset_created'
  | 'document_uploaded'
  | 'policy_created'
  | 'tax_created'
  | 'bill_created'
  | 'alert_sent';

export interface ActivityLogEntry {
  id: string;
  action: ActivityAction;
  entity_type: string;
  entity_name: string;
  description: string;
  timestamp: string;
}

export interface DashboardData {
  stats: DashboardStats;
  upcoming: UpcomingDeadline[];
  activity: ActivityLogEntry[];
}

export type CalendarCellStatus = 'paid' | 'overdue' | 'due';

export interface CalendarYearItem {
  entity_type: PayableEntityType;
  entity_id: string;
  name: string;
  amount: number | null;
  due_date: string; // YYYY-MM-DD
  status: CalendarCellStatus;
}
