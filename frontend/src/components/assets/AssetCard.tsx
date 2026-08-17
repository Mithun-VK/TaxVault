import { MoreVertical, Eye, Pencil, Archive, FileText, Receipt } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCan } from '@/hooks/usePermissions';
import { ASSET_TYPES } from '@/utils/constants';
import { formatDate } from '@/utils/dates';
import { isPropertyType, type Asset } from '@/types';

interface AssetCardProps {
  asset: Asset;
  onView: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
  onArchive: (asset: Asset) => void;
  /** Number of tax obligations linked to this property (Tier 1 badge). */
  taxCount?: number;
  /** Number of documents linked to this property (Tier 1 badge). */
  docCount?: number;
  /** Whether this card is the one currently selected in the detail panel. */
  selected?: boolean;
}

type Tier = 1 | 2 | 3;

/** Land & buildings are primary, vehicles secondary, everything else compact. */
function tierFor(asset: Asset): Tier {
  if (isPropertyType(asset.asset_type)) return 1;
  if (asset.asset_type === 'vehicle') return 2;
  return 3;
}

const TIER_ACCENT: Record<Tier, string> = {
  1: '#1A3C6E', // brand-navy
  2: '#9D174D', // rose
  3: '#475569', // slate
};

const TIER_PADDING: Record<Tier, string> = {
  1: 'p-5',
  2: 'p-4',
  3: 'p-3',
};

function meta(asset: Asset, key: string): string | undefined {
  const v = (asset.metadata as Record<string, unknown> | null)?.[key];
  return typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : undefined;
}

export function AssetCard({
  asset,
  onView,
  onEdit,
  onArchive,
  taxCount = 0,
  docCount = 0,
  selected = false,
}: AssetCardProps) {
  const tier = tierFor(asset);
  const accent = TIER_ACCENT[tier];
  const typeMeta = ASSET_TYPES.find((t) => t.value === asset.asset_type);
  const Icon = typeMeta?.icon;
  const canEdit = useCan('properties.edit');

  const location =
    meta(asset, 'address') ??
    meta(asset, 'location') ??
    ([meta(asset, 'taluk'), meta(asset, 'district')].filter(Boolean).join(', ') || undefined);

  return (
    <div
      className={cn(
        'group flex cursor-pointer flex-col rounded-xl border border-l-4 border-surface-border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover',
        TIER_PADDING[tier],
        selected && 'ring-2 ring-brand-navy/40',
      )}
      style={{ borderLeftColor: accent }}
      onClick={() => onView(asset)}
    >
      <div className="flex items-start justify-between gap-2">
        <Badge variant="outline" className="gap-1.5" style={{ color: accent, borderColor: `${accent}33` }}>
          {Icon && <Icon className="h-3 w-3" />}
          {typeMeta?.label}
        </Badge>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Property actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(asset)}>
                <Eye /> View
              </DropdownMenuItem>
              {canEdit && (
                <>
                  <DropdownMenuItem onClick={() => onEdit(asset)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onArchive(asset)}>
                    <Archive /> {asset.status === 'archived' ? 'Restore' : 'Archive'}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <h3
        className={cn(
          'mt-2 font-semibold text-slate-900',
          tier === 3 ? 'text-sm' : 'text-base',
        )}
      >
        {asset.name}
      </h3>

      {/* TIER 1 — Land & Buildings: patta / deed / location + linked counts */}
      {tier === 1 && (
        <>
          {location && <p className="mt-0.5 line-clamp-1 text-sm text-slate-700">{location}</p>}
          <dl className="mt-3 space-y-1 text-xs text-slate-700">
            {(meta(asset, 'patta_number') || meta(asset, 'survey_number')) && (
              <div className="flex justify-between gap-3">
                <dt>Patta / Survey</dt>
                <dd className="font-mono text-slate-700">
                  {meta(asset, 'patta_number') ?? meta(asset, 'survey_number')}
                </dd>
              </div>
            )}
            {(meta(asset, 'deed_number') || meta(asset, 'property_tax_id')) && (
              <div className="flex justify-between gap-3">
                <dt>{meta(asset, 'deed_number') ? 'Deed' : 'Tax ID'}</dt>
                <dd className="font-mono text-slate-700">
                  {meta(asset, 'deed_number') ?? meta(asset, 'property_tax_id')}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="gap-1">
              <Receipt className="h-3 w-3" /> {taxCount} tax
            </Badge>
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" /> {docCount} doc{docCount === 1 ? '' : 's'}
            </Badge>
          </div>
        </>
      )}

      {/* TIER 2 — Vehicles: registration / make / model */}
      {tier === 2 && (
        <dl className="mt-2 space-y-1 text-xs text-slate-700">
          {meta(asset, 'registration_number') && (
            <div className="flex justify-between gap-3">
              <dt>Registration</dt>
              <dd className="font-mono text-slate-700">{meta(asset, 'registration_number')}</dd>
            </div>
          )}
          {(meta(asset, 'make') || meta(asset, 'model')) && (
            <div className="flex justify-between gap-3">
              <dt>Make / Model</dt>
              <dd className="text-slate-700">
                {[meta(asset, 'make'), meta(asset, 'model')].filter(Boolean).join(' ')}
              </dd>
            </div>
          )}
        </dl>
      )}

      {tier !== 3 && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-600">
            Acquired {asset.acquisition_date ? formatDate(asset.acquisition_date) : '—'}
          </span>
          <StatusBadge status={asset.status} />
        </div>
      )}
    </div>
  );
}
