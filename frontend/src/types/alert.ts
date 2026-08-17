import type { PayableEntityType } from './payment';

/** WhatsApp (Twilio) is the deployment's working channel; the rest need
 *  external setup (SES / Firebase) most installs don't have. */
export type AlertChannel = 'whatsapp' | 'email' | 'sms' | 'push';

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

/** One change applied to every rule at once (optionally one payable type). */
export interface AlertBulkUpdate extends AlertConfigUpdate {
  entity_type?: PayableEntityType;
}

/** Twilio delivery setup, as reported by the backend. Never includes secrets. */
export interface WhatsAppStatus {
  configured: boolean;
  /** Masked, e.g. "+91••••3210". */
  recipient: string | null;
  sender: string | null;
  /** Env vars still missing when `configured` is false. */
  missing: string[];
}

export interface WhatsAppTestResult {
  sent: boolean;
  detail: string;
}

/** One change applied to every rule at once (optionally one payable type). */
export interface AlertBulkUpdate extends AlertConfigUpdate {
  entity_type?: PayableEntityType;
}

/** Twilio delivery status, as shown on the alerts page. Numbers arrive masked
 *  and the auth token is never sent to the client. */
export interface WhatsAppStatus {
  configured: boolean;
  recipient: string | null;
  sender: string | null;
  /** Env vars still missing when `configured` is false. */
  missing: string[];
}

export interface WhatsAppTestResult {
  sent: boolean;
  detail: string;
}
