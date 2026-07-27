import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CountdownChip } from '@/components/shared/CountdownChip';
import { INSURANCE_TYPES } from '@/utils/constants';
import { formatINR, getInsuranceTypeColor, getStatusLabel } from '@/utils/formatters';
import { formatDate } from '@/utils/dates';
import type { InsurancePolicy } from '@/types';

interface PolicyCardProps {
  policy: InsurancePolicy;
  onClick: (policy: InsurancePolicy) => void;
}

export function PolicyCard({ policy, onClick }: PolicyCardProps) {
  const color = getInsuranceTypeColor(policy.insurance_type);
  const typeMeta = INSURANCE_TYPES.find((t) => t.value === policy.insurance_type);
  const Icon = typeMeta?.icon;

  return (
    <button
      type="button"
      onClick={() => onClick(policy)}
      className="flex w-full flex-col rounded-xl border border-surface-border bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            {Icon && <Icon className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {policy.name || policy.provider}
            </h3>
            <p className="text-xs text-slate-600">
              {policy.name ? `${policy.provider} · ${policy.policy_number}` : policy.policy_number}
            </p>
          </div>
        </div>
        <StatusBadge status={policy.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-600">Sum insured</p>
          <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
            {policy.sum_insured != null ? formatINR(policy.sum_insured) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-600">Premium</p>
          <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
            {formatINR(policy.premium_amount)}
            <span className="ml-1 text-xs font-normal text-slate-600">
              /{getStatusLabel(policy.premium_frequency).toLowerCase()}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-surface-border pt-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" style={{ color }}>
            {typeMeta?.label ?? getStatusLabel(policy.insurance_type)}
          </Badge>
          <span className="text-xs text-slate-600">Next {formatDate(policy.next_premium_date)}</span>
        </div>
        {policy.status === 'active' && <CountdownChip date={policy.next_premium_date} />}
      </div>
    </button>
  );
}
