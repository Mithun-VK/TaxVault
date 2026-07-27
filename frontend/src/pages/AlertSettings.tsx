import { Receipt, Shield, CreditCard, Bell, type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { AlertConfigRow } from '@/components/alerts/AlertConfigRow';
import { useAlertConfigs, useAlertLogs, useUpdateAlertConfig } from '@/api/alerts';
import type { AlertConfig, PayableEntityType } from '@/types';

const SECTIONS: {
  type: PayableEntityType;
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    type: 'tax',
    title: 'Tax obligations',
    description: 'Property tax, land tax, water tax, and compliance filings',
    icon: Receipt,
  },
  {
    type: 'insurance',
    title: 'Insurance premiums',
    description: 'Life, medical, and vehicle insurance renewal reminders',
    icon: Shield,
  },
  {
    type: 'bill',
    title: 'Recurring bills',
    description: 'Monthly bills, annual renewals, and license fees',
    icon: CreditCard,
  },
];

// The three reminder windows offered to the user
export const ALERT_DAYS_OPTIONS = [15, 7, 1] as const;

export function AlertSettings() {
  const { data: configs = [], isLoading } = useAlertConfigs();
  const { data: logs = [] } = useAlertLogs();
  const updateConfig = useUpdateAlertConfig();

  const handleUpdate = (
    id: string,
    data: Parameters<typeof updateConfig.mutate>[0]['data'],
  ) => updateConfig.mutate({ id, data });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No alert rules configured"
        description="Add taxes, insurance policies, or bills — alert rules will appear here automatically."
      />
    );
  }

  const grouped = (type: PayableEntityType): AlertConfig[] =>
    configs.filter((c) => c.entity_type === type);

  const totalActive = configs.filter((c) => c.enabled).length;

  return (
    <div className="space-y-8">

      {/* Header summary strip */}
      <div className="flex items-center justify-between rounded-xl border border-border-DEFAULT
                      bg-brand-navy-muted px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-brand-navy">
            {totalActive} of {configs.length} alerts active
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            Reminders fire 15, 7, and 1 day before each deadline
          </p>
        </div>
        <Bell className="h-5 w-5 text-brand-navy opacity-60" aria-hidden="true" />
      </div>

      {/* Reminder schedule legend */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted font-medium">Reminder windows:</span>
        {ALERT_DAYS_OPTIONS.map((d) => (
          <span
            key={d}
            className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5
                       text-xs font-semibold text-slate-600"
          >
            {d === 1 ? '1 day before' : `${d} days before`}
          </span>
        ))}
      </div>

      {/* Sections */}
      {SECTIONS.map(({ type, title, description, icon: Icon }) => {
        const items = grouped(type);
        if (items.length === 0) return null;

        return (
          <section key={type} aria-labelledby={`section-${type}`}>

            {/* Section header */}
            <div className="mb-3 flex items-start gap-3 border-b border-border-subtle pb-3">
              <div className="mt-0.5 rounded-lg bg-brand-navy-muted p-2">
                <Icon className="h-4 w-4 text-brand-navy" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id={`section-${type}`}
                  className="text-sm font-semibold text-text-primary"
                >
                  {title}
                  <span className="ml-2 text-xs font-normal text-text-muted">
                    ({items.length})
                  </span>
                </h2>
                <p className="text-xs text-text-muted mt-0.5">{description}</p>
              </div>
            </div>

            {/* Config rows */}
            <div className="space-y-2">
              {items.map((config) => (
                <AlertConfigRow
                  key={config.id}
                  config={config}
                  logs={logs.filter((l) => l.entity_id === config.entity_id)}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>

          </section>
        );
      })}
    </div>
  );
}