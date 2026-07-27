import { Mail, MessageSquare, Bell, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/utils/dates';
import type { AlertChannel, AlertLog } from '@/types';

const CHANNEL_ICON: Record<AlertChannel, LucideIcon> = {
  email: Mail,
  sms: MessageSquare,
  push: Bell,
};

const STATUS_DOT: Record<string, string> = {
  sent: 'bg-brand-teal',
  failed: 'bg-brand-danger',
  pending: 'bg-amber-400',
};

export function AlertLogTimeline({ logs }: { logs: AlertLog[] }) {
  if (logs.length === 0) {
    return <p className="py-3 text-sm text-slate-600">No alerts sent yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {logs.slice(0, 10).map((log) => {
        const Icon = CHANNEL_ICON[log.channel];
        return (
          <li key={log.id} className="flex items-start gap-3">
            <div className="relative mt-0.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span
                className={cn(
                  'absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white',
                  STATUS_DOT[log.status] ?? 'bg-slate-300',
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-700">{log.message}</p>
              <p className="mt-0.5 text-xs text-slate-600">
                {formatDateTime(log.sent_at)} · {log.days_before} day(s) before · {log.status}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
