import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Briefcase,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Users,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchInput } from '@/components/shared/SearchInput';
import { useCompanies } from '@/api/companies';
import { useDebounce } from '@/hooks/useDebounce';
import { useCan } from '@/hooks/usePermissions';
import { getInitials } from '@/utils/formatters';
import { COMPANY_STATUSES, COMPANY_TYPES, COMPANY_TYPE_COLOR } from '@/utils/constants';
import { cn } from '@/lib/utils';
import type { Company } from '@/types';

const typeLabel = (value: string) =>
  COMPANY_TYPES.find((t) => t.value === value)?.label ?? value;
const statusOption = (value: string) => COMPANY_STATUSES.find((s) => s.value === value);

/** Registration presence chip - the same ✓/✗ vocabulary as the Individual card. */
function RegChip({ label, ok }: { label: string; ok: boolean }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium',
        ok ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const opt = statusOption(status);
  const tone =
    opt?.color === 'green'
      ? 'bg-emerald-50 text-emerald-700'
      : opt?.color === 'amber'
        ? 'bg-amber-50 text-amber-700'
        : opt?.color === 'red'
          ? 'bg-red-50 text-brand-danger'
          : 'bg-slate-100 text-slate-600';
  return (
    <span className={cn('rounded-md px-1.5 py-0.5 text-[12px] font-medium', tone)}>
      {opt?.label ?? status}
    </span>
  );
}

function CompanyCard({ company }: { company: Company }) {
  const navigate = useNavigate();
  const accent = COMPANY_TYPE_COLOR[company.company_type] ?? COMPANY_TYPE_COLOR.other;
  const expiring = company.expiring_docs_count;

  return (
    <button
      type="button"
      onClick={() => navigate(`/company/${company.id}`)}
      className="flex flex-col rounded-xl border border-l-4 border-surface-border bg-white p-4 text-left transition-shadow hover:shadow-sm"
      style={{ borderLeftColor: accent }}
    >
      <div className="flex items-start gap-3">
        {company.logo_url ? (
          <img
            src={company.logo_url}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          >
            {getInitials(company.legal_name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {company.legal_name}
            </h3>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          </div>
          {company.trade_name && company.trade_name !== company.legal_name && (
            <p className="truncate text-xs text-slate-600">{company.trade_name}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusPill status={company.status} />
            <span className="truncate text-[12px] text-slate-700">
              {typeLabel(company.company_type)}
            </span>
          </div>
          {company.industry && (
            <p className="mt-0.5 truncate text-[12px] text-slate-600">{company.industry}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-surface-border pt-3">
        <RegChip label="CIN" ok={!!company.cin} />
        <RegChip label="GSTIN" ok={!!company.gstin} />
        <RegChip label="PAN" ok={!!company.pan_number} />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-600">
        <span className="inline-flex items-center gap-1">
          <FileText className="h-3 w-3" aria-hidden="true" /> {company.document_count} doc
          {company.document_count === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-1">
          <Building2 className="h-3 w-3" aria-hidden="true" /> {company.asset_count} propert
          {company.asset_count === 1 ? 'y' : 'ies'}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3 w-3" aria-hidden="true" /> {company.active_director_count}{' '}
          director{company.active_director_count === 1 ? '' : 's'}
        </span>
      </div>

      {expiring > 0 && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[12px] font-medium text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {expiring} registration{expiring === 1 ? '' : 's'} expiring within 90 days
        </div>
      )}

      {company.has_compliance_gap && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-[12px] font-medium text-brand-danger">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          No filing on record for the last closed financial year
        </div>
      )}
    </button>
  );
}

export function CompanyList() {
  const navigate = useNavigate();
  const canCreate = useCan('company.create');
  const { data, isLoading } = useCompanies();

  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const debounced = useDebounce(search);

  const companies = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    return (data?.items ?? [])
      .filter((c) => {
        if (type !== 'all' && c.company_type !== type) return false;
        if (status !== 'all' && c.status !== status) return false;
        if (!term) return true;
        return (
          c.legal_name.toLowerCase().includes(term) ||
          (c.trade_name ?? '').toLowerCase().includes(term) ||
          (c.industry ?? '').toLowerCase().includes(term)
        );
      })
      // Active entities lead; the rest keep the API's alphabetical order.
      .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active'));
  }, [data, debounced, type, status]);

  const hasAny = (data?.items ?? []).length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Companies</h1>
          <p className="mt-0.5 text-sm text-slate-700">
            Business entities, registrations, filings and company-held properties
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => navigate('/company/new')}>
            <Plus className="h-4 w-4" /> Add Company
          </Button>
        )}
      </div>

      {hasAny && (
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search companies…"
            className="w-full sm:max-w-xs"
          />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {COMPANY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {COMPANY_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      ) : !hasAny ? (
        <EmptyState
          icon={Briefcase}
          title="No companies added yet"
          description="Add your businesses to track registrations, compliance filings, and linked properties"
          action={
            canCreate ? (
              <Button onClick={() => navigate('/company/new')}>
                <Plus className="h-4 w-4" /> Add Company
              </Button>
            ) : undefined
          }
        />
      ) : companies.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No companies match these filters"
          description="Try a different search term, type or status."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
          {companies.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      )}
    </div>
  );
}
