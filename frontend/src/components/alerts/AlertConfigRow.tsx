import { Mail, MessageSquare, Bell, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { AlertLogTimeline } from './AlertLogTimeline';
import { ALERT_CHANNELS, ALERT_DAYS } from '@/utils/constants';
import { formatDate } from '@/utils/dates';
import { formatINR, getEntityTypeLabel } from '@/utils/formatters';
import type { AlertChannel, AlertConfig, AlertConfigUpdate, AlertDays, AlertLog } from '@/types';

const CHANNEL_ICON: Record<AlertChannel, LucideIcon> = {
  email: Mail,
  sms: MessageSquare,
  push: Bell,
};

interface AlertConfigRowProps {
  config: AlertConfig;
  logs: AlertLog[];
  onUpdate: (id: string, data: AlertConfigUpdate) => void;
}

export function AlertConfigRow({ config, logs, onUpdate }: AlertConfigRowProps) {
  const toggleChannel = (channel: AlertChannel) => {
    const next = config.channels.includes(channel)
      ? config.channels.filter((c) => c !== channel)
      : [...config.channels, channel];
    onUpdate(config.id, { channels: next });
  };

  const toggleDay = (day: AlertDays) => {
    const next = config.days_before.includes(day)
      ? config.days_before.filter((d) => d !== day)
      : [...config.days_before, day].sort((a, b) => b - a);
    onUpdate(config.id, { days_before: next });
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-surface-border bg-white p-4 transition-opacity',
        !config.enabled && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{config.entity_name}</h3>
            <Badge variant="outline" className="text-slate-700">
              {getEntityTypeLabel(config.entity_type)}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            {formatINR(config.amount)} · due {formatDate(config.due_date)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">{config.enabled ? 'On' : 'Off'}</span>
          <Switch
            checked={config.enabled}
            onCheckedChange={(c) => onUpdate(config.id, { enabled: c })}
            aria-label="Toggle alerts"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          {ALERT_CHANNELS.map((ch) => {
            const Icon = CHANNEL_ICON[ch.value];
            const active = config.channels.includes(ch.value);
            return (
              <button
                key={ch.value}
                type="button"
                disabled={!config.enabled}
                onClick={() => toggleChannel(ch.value)}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed',
                  active
                    ? 'border-transparent text-white'
                    : 'border-surface-border bg-white text-slate-600 hover:bg-slate-50',
                )}
                style={active ? { backgroundColor: ch.color } : undefined}
              >
                <Icon className="h-3 w-3" />
                {ch.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-600">Notify</span>
          {ALERT_DAYS.map((day) => {
            const active = config.days_before.includes(day);
            return (
              <button
                key={day}
                type="button"
                disabled={!config.enabled}
                onClick={() => toggleDay(day)}
                className={cn(
                  'h-7 w-7 rounded-full border text-xs font-medium tabular-nums transition-colors disabled:cursor-not-allowed',
                  active
                    ? 'border-brand-navy bg-brand-navy text-white'
                    : 'border-surface-border bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {day}
              </button>
            );
          })}
          <span className="text-xs text-slate-600">days before</span>
        </div>
      </div>

      <Accordion type="single" collapsible className="mt-2">
        <AccordionItem value="history" className="border-b-0">
          <AccordionTrigger className="py-2 text-xs text-slate-700">
            Alert history ({logs.length})
          </AccordionTrigger>
          <AccordionContent>
            <AlertLogTimeline logs={logs} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
