import { useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  MessageCircle,
  Receipt,
  Send,
  Shield,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/shared/EmptyState';
import { AlertLogTimeline } from '@/components/alerts/AlertLogTimeline';
import {
  useAlertConfigs,
  useAlertLogs,
  useBulkUpdateAlertConfigs,
  useSendWhatsAppTest,
  useUpdateAlertConfig,
  useWhatsAppStatus,
} from '@/api/alerts';
import { useCan } from '@/hooks/usePermissions';
import { ALERT_DAYS } from '@/utils/constants';
import { formatDate } from '@/utils/dates';
import { formatINR } from '@/utils/formatters';
import type { AlertConfig, AlertDays, PayableEntityType } from '@/types';

const GROUPS: { type: PayableEntityType; title: string; icon: LucideIcon }[] = [
  { type: 'tax', title: 'Taxes', icon: Receipt },
  { type: 'insurance', title: 'Insurance', icon: Shield },
  { type: 'bill', title: 'Bills', icon: CreditCard },
];

function dayLabel(day: AlertDays): string {
  return day === 1 ? '1 day before' : `${day} days before`;
}

/**
 * The reminder schedule shared by every rule, or null when rules disagree.
 * Days are a household-wide preference, so the page shows a single control -
 * but it must not silently claim an agreement that isn't there.
 */
function sharedSchedule(configs: AlertConfig[]): AlertDays[] | null {
  if (configs.length === 0) return null;
  const key = (days: AlertDays[]) => [...days].sort((a, b) => b - a).join(',');
  const first = key(configs[0].days_before);
  return configs.every((c) => key(c.days_before) === first)
    ? [...configs[0].days_before].sort((a, b) => b - a)
    : null;
}

/** WhatsApp connection state, and a way to prove it actually delivers. */
function DeliveryCard({ canEdit }: { canEdit: boolean }) {
  const { data: status, isLoading } = useWhatsAppStatus();
  const sendTest = useSendWhatsAppTest();

  if (isLoading) return <Skeleton className="h-28 w-full rounded-xl" />;
  if (!status) return null;

  const connected = status.configured && !!status.recipient;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              connected ? 'bg-[#25D366]/10 text-[#128C7E]' : 'bg-amber-50 text-amber-700',
            )}
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">WhatsApp reminders</p>
            {connected ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-teal" aria-hidden="true" />
                Sending to <span className="font-medium">{status.recipient}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-slate-700">
                {status.configured
                  ? 'Connected, but no recipient number is set.'
                  : 'Not connected - reminders cannot be delivered yet.'}
              </p>
            )}
          </div>
        </div>

        {canEdit && connected && (
          <Button variant="outline" disabled={sendTest.isPending} onClick={() => sendTest.mutate()}>
            <Send className="h-4 w-4" />
            {sendTest.isPending ? 'Sending…' : 'Send test message'}
          </Button>
        )}
      </div>

      {!connected && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="min-w-0 text-xs text-amber-900">
            <p className="font-medium">Finish the setup in backend/.env</p>
            <p className="mt-1">
              {status.missing.length > 0
                ? `Missing: ${status.missing.join(', ')}`
                : 'Set TWILIO_WHATSAPP_TO to the number reminders should go to.'}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

/** One payable, with nothing but an on/off switch. */
function ConfigRow({
  config,
  canEdit,
  onToggle,
}: {
  config: AlertConfig;
  canEdit: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-800">{config.entity_name}</p>
        <p className="text-xs text-slate-600">
          {config.amount > 0 ? `${formatINR(config.amount)} · ` : ''}
          due {formatDate(config.due_date)}
        </p>
      </div>
      <Switch
        checked={config.enabled}
        disabled={!canEdit}
        onCheckedChange={onToggle}
        aria-label={`Reminders for ${config.entity_name}`}
      />
    </div>
  );
}

function Group({
  title,
  icon: Icon,
  configs,
  canEdit,
  onToggleOne,
  onToggleAll,
}: {
  title: string;
  icon: LucideIcon;
  configs: AlertConfig[];
  canEdit: boolean;
  onToggleOne: (id: string, enabled: boolean) => void;
  onToggleAll: (enabled: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = configs.filter((c) => c.enabled).length;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <Icon className="h-[18px] w-[18px] text-slate-600" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900">{title}</span>
            <span className="block text-xs text-slate-600">
              {activeCount} of {configs.length} on
            </span>
          </span>
          <ChevronDown
            className={cn(
              'ml-auto h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
        <Switch
          checked={activeCount > 0}
          disabled={!canEdit}
          onCheckedChange={onToggleAll}
          aria-label={`All ${title.toLowerCase()} reminders`}
        />
      </div>

      {open && (
        <div className="divide-y divide-surface-border border-t border-surface-border px-4">
          {configs.map((c) => (
            <ConfigRow
              key={c.id}
              config={c}
              canEdit={canEdit}
              onToggle={(enabled) => onToggleOne(c.id, enabled)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * Alerts, rebuilt around the two questions that actually matter: is WhatsApp
 * delivering, and when should it fire.
 *
 * The reminder schedule is one household-wide control applied to every rule at
 * once, and each payable keeps only an on/off switch. The old page repeated a
 * channel picker and a day picker on every row, so a vault with thirty
 * payables meant thirty copies of the same decision.
 */
export function AlertSettings() {
  const canEdit = useCan('alerts.edit');
  const { data: configs = [], isLoading } = useAlertConfigs();
  const { data: logs = [] } = useAlertLogs();
  const updateConfig = useUpdateAlertConfig();
  const bulkUpdate = useBulkUpdateAlertConfigs();

  const schedule = useMemo(() => sharedSchedule(configs), [configs]);
  const activeCount = configs.filter((c) => c.enabled).length;

  const toggleDay = (day: AlertDays) => {
    // With mixed schedules there is nothing to toggle off, so start from the
    // clicked day rather than an arbitrary rule's settings.
    const current = schedule ?? [];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => b - a);
    bulkUpdate.mutate({ days_before: next });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Alerts</h1>
        <p className="mt-0.5 text-sm text-slate-700">
          Payment reminders, delivered to WhatsApp before each deadline.
        </p>
      </div>

      <DeliveryCard canEdit={canEdit} />

      {configs.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nothing to remind you about yet"
          description="Add a bill, tax or insurance policy - a reminder rule is created for it automatically."
        />
      ) : (
        <>
          {/* Reminder schedule - one control governing every rule */}
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">When to remind</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {schedule
                    ? 'Applies to every reminder.'
                    : 'Your reminders currently use different schedules - pick one to apply to all.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">
                  {activeCount} of {configs.length} on
                </span>
                <Switch
                  checked={activeCount > 0}
                  disabled={!canEdit || bulkUpdate.isPending}
                  onCheckedChange={(enabled) => bulkUpdate.mutate({ enabled })}
                  aria-label="All reminders"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {ALERT_DAYS.map((day) => {
                const active = (schedule ?? []).includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!canEdit || bulkUpdate.isPending}
                    onClick={() => toggleDay(day)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                      'disabled:cursor-not-allowed disabled:opacity-60',
                      active
                        ? 'border-brand-navy bg-brand-navy text-white'
                        : 'border-surface-border bg-white text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {dayLabel(day)}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* What gets reminders - collapsed by default, switch only */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              What gets reminders
            </h2>
            {GROUPS.map(({ type, title, icon }) => {
              const items = configs.filter((c) => c.entity_type === type);
              if (items.length === 0) return null;
              return (
                <Group
                  key={type}
                  title={title}
                  icon={icon}
                  configs={items}
                  canEdit={canEdit}
                  onToggleOne={(id, enabled) => updateConfig.mutate({ id, data: { enabled } })}
                  onToggleAll={(enabled) => bulkUpdate.mutate({ entity_type: type, enabled })}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Recent activity */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Recent activity
        </h2>
        <Card className="p-5">
          <AlertLogTimeline logs={logs} />
        </Card>
      </div>
    </div>
  );
}
