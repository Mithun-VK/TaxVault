import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Users,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Phone,
  Mail,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { useIndividuals } from '@/api/individuals';
import { useCan } from '@/hooks/usePermissions';
import { getInitials } from '@/utils/formatters';
import { daysUntil } from '@/utils/dates';
import { cn } from '@/lib/utils';
import type { Individual } from '@/types';

function DocChip({ label, ok, warn }: { label: string; ok: boolean; warn?: boolean }) {
  const Icon = !ok ? XCircle : warn ? AlertTriangle : CheckCircle2;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium',
        !ok
          ? 'bg-red-50 text-brand-danger'
          : warn
            ? 'bg-amber-50 text-amber-600'
            : 'bg-emerald-50 text-emerald-600',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Nearest expiry warning string, or null. */
function expiryWarning(ind: Individual): { text: string; danger: boolean } | null {
  const items: { label: string; days: number }[] = [];
  if (ind.passport_expiry) items.push({ label: 'Passport', days: daysUntil(ind.passport_expiry) });
  for (const v of ind.visas ?? []) {
    if (v.expiry_date)
      items.push({ label: `${v.country} visa`, days: daysUntil(v.expiry_date) });
  }
  const soon = items
    .filter((i) => i.days <= 90)
    .sort((a, b) => a.days - b.days)[0];
  if (!soon) return null;
  if (soon.days < 0) return { text: `${soon.label} expired`, danger: true };
  return { text: `${soon.label} expires in ${soon.days} days`, danger: soon.days < 30 };
}

function IndividualCard({ ind }: { ind: Individual }) {
  const navigate = useNavigate();
  const warn = expiryWarning(ind);
  const passportWarn = ind.passport_expiry ? daysUntil(ind.passport_expiry) <= 90 : false;

  return (
    <button
      type="button"
      onClick={() => navigate(`/individual/${ind.id}`)}
      className="flex flex-col rounded-xl border border-surface-border bg-white p-4 text-left transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-11 w-11">
          <AvatarFallback className="bg-brand-navy text-sm text-white">
            {getInitials(ind.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900">{ind.full_name}</h3>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          </div>
          <p className="truncate text-xs text-slate-700">
            {ind.relationship_to_owner ?? 'Family Member'}
            {ind.email ? ` · ${ind.email}` : ''}
          </p>
          {(ind.phone_number || ind.email) && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-slate-600">
              {ind.phone_number && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {ind.phone_number}
                </span>
              )}
              {ind.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {ind.email}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-surface-border pt-3">
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] font-medium text-slate-600">
          <Building2 className="h-3 w-3" aria-hidden="true" /> {ind.asset_count} propert
          {ind.asset_count === 1 ? 'y' : 'ies'}
        </span>
        <DocChip label="Aadhaar" ok={!!ind.aadhaar_number} />
        <DocChip label="PAN" ok={!!ind.pan_number} />
        <DocChip label="Passport" ok={!!ind.passport_number} warn={passportWarn} />
      </div>

      {warn && (
        <div
          className={cn(
            'mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium',
            warn.danger ? 'bg-red-50 text-brand-danger' : 'bg-amber-50 text-amber-700',
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {warn.text}
        </div>
      )}
    </button>
  );
}

export function IndividualList() {
  const navigate = useNavigate();
  const canCreate = useCan('individuals.create');
  const { data, isLoading } = useIndividuals();
  const individuals = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Individual Profiles
          </h1>
          <p className="mt-0.5 text-sm text-slate-700">
            Personal documents and linked assets for each family member
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => navigate('/individual/new')}>
            <Plus className="h-4 w-4" /> Add Individual
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : individuals.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No individuals added yet"
          description="Add family members to track their properties and documents"
          action={
            canCreate ? (
              <Button onClick={() => navigate('/individual/new')}>
                <Plus className="h-4 w-4" /> Add Individual
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
          {individuals.map((ind) => (
            <IndividualCard key={ind.id} ind={ind} />
          ))}
        </div>
      )}
    </div>
  );
}
