import type { PayableEntityType } from './payment';

export type AlertChannel = 'email' | 'sms' | 'push';

export type AlertDays = 30 | 15 | 7 | 3 | 1;

export type AlertLogStatus = 'sent' | 'failed' | 'pending';

export interface AlertConfig {
  id: string;
  entity_type: PayableEntityType;
  entity_id: string;
  entity_name: string;
  due_date: string;
  amount: number;
  enabled: boolean;
  channels: AlertChannel[];
  days_before: AlertDays[];
}

export interface AlertLog {
  id: string;
  entity_type: PayableEntityType;
  entity_id: string;
  entity_name: string;
  channel: AlertChannel;
  status: AlertLogStatus;
  days_before: number;
  message: string;
  sent_at: string;
}

export interface AlertConfigUpdate {
  enabled?: boolean;
  channels?: AlertChannel[];
  days_before?: AlertDays[];
}
