import { FileWarning } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatINR } from '@/utils/formatters';
import { formatDate } from '@/utils/dates';
import type { InsuranceClaim } from '@/types';

export function ClaimHistory({ claims }: { claims: InsuranceClaim[] }) {
  if (claims.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-surface-border py-10 text-center">
        <FileWarning className="h-6 w-6 text-slate-500" />
        <p className="mt-2 text-sm text-slate-600">No claims filed on this policy.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {claims.map((claim) => (
        <div
          key={claim.id}
          className="flex items-center justify-between rounded-lg border border-surface-border bg-white p-3"
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-800">{claim.claim_number}</p>
              <StatusBadge status={claim.status} />
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              {formatDate(claim.date)} · {claim.description}
            </p>
          </div>
          <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">
            {formatINR(claim.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}
