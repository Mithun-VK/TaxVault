import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Building2,
  FileText,
  Receipt,
  Download,
  Landmark,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/shared/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { SlideOverDrawer } from '@/components/shared/SlideOverDrawer';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DocumentUploader } from '@/components/shared/DocumentUploader';
import { AssetCard } from '@/components/assets/AssetCard';
import { GoldVault } from '@/components/assets/GoldVault';
import { ExportButton } from '@/components/shared/ExportButton';
import { useAssets, useUpdateAsset, useArchiveAsset } from '@/api/assets';
import { useIndividuals } from '@/api/individuals';
import { useGoldCategories } from '@/api/goldCategories';
import { useTaxes } from '@/api/taxes';
import { useDocuments, useDownloadUrl, triggerDownload } from '@/api/documents';
import { useEntityPayments } from '@/api/payments';
import { useDebounce } from '@/hooks/useDebounce';
import { useCan } from '@/hooks/usePermissions';
import { generatePropertiesReport, generateGoldReport } from '@/utils/reports';
import { formatINR, getAssetOwner, getInitials, getAssetValue } from '@/utils/formatters';
import { getPropertyDetailRows } from '@/utils/propertyFields';
import { formatDate } from '@/utils/dates';
import { queryClient } from '@/api/client';
import { isPropertyType } from '@/types';
import type { Asset, AssetType, Tax, TaxDocument } from '@/types';

const VALID_TYPES = [
  'residential_building',
  'commercial_building',
  'agricultural_land',
  'non_agricultural_land',
  'vehicle',
  'gold',
] as const;
const TYPE_PLURAL: Record<string, string> = {
  residential_building: 'Residential Buildings',
  commercial_building: 'Commercial Buildings',
  agricultural_land: 'Agricultural Land',
  non_agricultural_land: 'Non-Agricultural Land',
  vehicle: 'Vehicles',
  gold: 'Gold',
};

type TabKey = 'all' | 'by_owner';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'by_owner', label: 'By Owner' },
];

// Movable / immovable category → the concrete asset types each contains.
type CategoryKey = 'all' | 'immovable' | 'movable';
const CATEGORY_TYPES: Record<Exclude<CategoryKey, 'all'>, AssetType[]> = {
  immovable: [
    'residential_building',
    'commercial_building',
    'agricultural_land',
    'non_agricultural_land',
  ],
  movable: ['vehicle', 'gold'],
};
const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: 'all', label: 'All types' },
  { key: 'immovable', label: 'Immovable' },
  { key: 'movable', label: 'Movable' },
];

export function Properties() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');
  const typeParam = searchParams.get('type'); // land|building|vehicle|gold
  // A specific type (from the Gold/Vehicles/Buildings/Land nav) scopes the page
  // to that one type; otherwise the overview lists every property.
  const scopedType =
    typeParam && (VALID_TYPES as readonly string[]).includes(typeParam)
      ? (typeParam as AssetType)
      : null;
  const isGold = scopedType === 'gold';
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabKey>('all');
  // Movable/immovable category + optional specific type - only used on the
  // unscoped overview (a nav-scoped page already fixes the type).
  const [category, setCategory] = useState<CategoryKey>('all');
  const [subType, setSubType] = useState<AssetType | 'all'>('all');
  const debounced = useDebounce(search);

  const [archiveTarget, setArchiveTarget] = useState<Asset | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadFor, setUploadFor] = useState<Asset | null>(null);

  const { data: allAssets = [], isLoading } = useAssets();
  const { data: individualsData } = useIndividuals();
  const { data: goldCategories = [] } = useGoldCategories();
  const { data: taxes = [] } = useTaxes();
  const { data: documents = [] } = useDocuments();

  // individual_id -> full name, for the "By Owner" grouping.
  const individualName = useMemo(() => {
    const m = new Map<string, string>();
    for (const ind of individualsData?.items ?? []) m.set(ind.id, ind.full_name);
    return m;
  }, [individualsData]);

  const updateAsset = useUpdateAsset();
  const archiveAsset = useArchiveAsset();
  const downloadUrl = useDownloadUrl();
  const canCreate = useCan('properties.create');
  const canEdit = useCan('properties.edit');
  const canAddCategory = useCan('gold_categories.create');
  const canDeleteCategory = useCan('gold_categories.delete');

  // entity_id -> linked tax / document counts, for the Tier 1 badges.
  const taxByAsset = useMemo(() => {
    const m = new Map<string, typeof taxes>();
    for (const t of taxes) {
      if (!t.linked_asset_id) continue;
      const arr = m.get(t.linked_asset_id) ?? [];
      arr.push(t);
      m.set(t.linked_asset_id, arr);
    }
    return m;
  }, [taxes]);

  const docsByAsset = useMemo(() => {
    const m = new Map<string, typeof documents>();
    for (const d of documents) {
      if (d.entity_type !== 'asset' || !d.entity_id) continue;
      const arr = m.get(d.entity_id) ?? [];
      arr.push(d);
      m.set(d.entity_id, arr);
    }
    return m;
  }, [documents]);

  const docsById = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents]);

  const summary = useMemo(() => {
    if (scopedType) {
      const count = allAssets.filter((a) => a.asset_type === scopedType).length;
      return { scoped: true as const, count, label: TYPE_PLURAL[scopedType] ?? scopedType };
    }
    const buildings = allAssets.filter(
      (a) => a.asset_type === 'residential_building' || a.asset_type === 'commercial_building',
    ).length;
    const land = allAssets.filter(
      (a) => a.asset_type === 'agricultural_land' || a.asset_type === 'non_agricultural_land',
    ).length;
    return { scoped: false as const, total: allAssets.length, buildings, land };
  }, [allAssets, scopedType]);

  // Types allowed by the current category/sub-type selection (overview only).
  const allowedTypes = useMemo<Set<AssetType> | null>(() => {
    if (scopedType || category === 'all') return null;
    if (subType !== 'all') return new Set([subType]);
    return new Set(CATEGORY_TYPES[category]);
  }, [scopedType, category, subType]);

  const visible = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return allAssets.filter((a) => {
      if (scopedType && a.asset_type !== scopedType) return false;
      if (allowedTypes && !allowedTypes.has(a.asset_type)) return false;
      if (q && !`${a.name} ${a.description ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allAssets, debounced, scopedType, allowedTypes]);

  // Properties grouped by owner (individual link first, then owner_name).
  const byOwner = useMemo(() => {
    const groups = new Map<string, Asset[]>();
    for (const a of visible) {
      const owner =
        (a.individual_id ? individualName.get(a.individual_id) : undefined) ??
        getAssetOwner(a) ??
        'Unassigned';
      const arr = groups.get(owner) ?? [];
      arr.push(a);
      groups.set(owner, arr);
    }
    return [...groups.entries()].sort((x, y) => y[1].length - x[1].length);
  }, [visible, individualName]);

  const selected = useMemo(
    () => allAssets.find((a) => a.id === selectedId) ?? null,
    [allAssets, selectedId],
  );

  const openCreate = () => {
    navigate(categoryParam ? `/assets/new?category=${categoryParam}` : '/assets/new');
  };
  // Add a jewel from inside a gold category - pre-selects that category.
  const openCreateGold = (category: string) => {
    navigate(`/assets/new?type=gold&gold_category=${encodeURIComponent(category)}`);
  };
  const openEdit = (asset: Asset) => {
    navigate(`/assets/${asset.id}/edit`);
  };

  // The desktop side panel only renders immovable Property Details, so movable
  // assets (gold, vehicles) always open their own full detail page. Immovable
  // properties use the side panel on desktop and the full page on mobile.
  const handleView = (asset: Asset) => {
    if (isPropertyType(asset.asset_type) && window.matchMedia('(min-width: 1024px)').matches) {
      setSelectedId(asset.id);
    } else {
      navigate(`/assets/${asset.id}`);
    }
  };

  const handleDownload = async (id: string) => {
    const url = await downloadUrl.mutateAsync(id);
    triggerDownload(url);
  };

  return (
    <div className="space-y-5">
      {/* SECTION A - summary strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-white px-4 py-3">
        {isLoading ? (
          <Skeleton className="h-4 w-72" />
        ) : summary.scoped ? (
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{summary.count}</span> {summary.label}
          </p>
        ) : (
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{summary.total}</span> properties
            {' · '}
            <span className="font-semibold text-slate-900">{summary.buildings}</span> buildings
            {' · '}
            <span className="font-semibold text-slate-900">{summary.land}</span> land parcels
          </p>
        )}
        <div className="flex items-center gap-2">
          <ExportButton
            onExport={() =>
              isGold
                ? generateGoldReport(
                    allAssets.filter((a) => a.asset_type === 'gold'),
                    goldCategories,
                    { download: true },
                  )
                : generatePropertiesReport(
                    scopedType ? allAssets.filter((a) => a.asset_type === scopedType) : allAssets,
                    { download: true },
                  )
            }
            disabled={allAssets.length === 0}
          />
          {/* Gold manages its own actions (Add category / Add gold) inside the vault. */}
          {canCreate && !isGold && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add {scopedType ? TYPE_PLURAL[scopedType].toLowerCase() : 'property'}
            </Button>
          )}
        </div>
      </div>

      {/* Owner filter + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {!isGold &&
            TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  tab === t.key ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {t.label}
              </button>
            ))}
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search ${scopedType ? TYPE_PLURAL[scopedType].toLowerCase() : 'properties'}…`}
          className="w-full sm:w-56"
        />
      </div>

      {/* Movable / immovable category → specific type filter (overview only) */}
      {!isGold && !scopedType && (
        <div className="flex flex-col gap-2 rounded-xl border border-surface-border bg-white p-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="shrink-0 pl-1 pr-0.5 text-xs font-medium uppercase tracking-wide text-slate-600">
              Category
            </span>
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  setCategory(c.key);
                  setSubType('all');
                }}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  category === c.key
                    ? 'bg-brand-navy text-white'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {category !== 'all' && (
            <div className="flex items-center gap-1.5 overflow-x-auto sm:border-l sm:border-surface-border sm:pl-3">
              <span className="shrink-0 pl-1 pr-0.5 text-xs font-medium uppercase tracking-wide text-slate-600">
                Type
              </span>
              <button
                type="button"
                onClick={() => setSubType('all')}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  subType === 'all'
                    ? 'bg-brand-navy text-white'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                All
              </button>
              {CATEGORY_TYPES[category].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSubType(t)}
                  className={cn(
                    'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    subType === t
                      ? 'bg-brand-navy text-white'
                      : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {TYPE_PLURAL[t] ?? t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isGold ? (
        <GoldVault
          assets={visible}
          isLoading={isLoading}
          canAddGold={canCreate}
          canEditGold={canEdit}
          canAddCategory={canAddCategory}
          canDeleteCategory={canDeleteCategory}
          onView={handleView}
          onEdit={openEdit}
          onAddGold={openCreateGold}
          onArchive={(a) =>
            a.status === 'archived'
              ? updateAsset.mutate({ id: a.id, data: { status: 'active' } })
              : setArchiveTarget(a)
          }
        />
      ) : tab === 'by_owner' ? (
        // By-Owner has no side detail panel, so open the full detail page directly.
        <ByOwnerView
          groups={byOwner}
          isLoading={isLoading}
          onView={(a) => navigate(`/assets/${a.id}`)}
        />
      ) : (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left - filtered card grid */}
        <div className="space-y-4 lg:col-span-2">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-52 w-full rounded-xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={allAssets.length === 0 ? 'No properties added yet' : 'No matching properties'}
              description="Add land, buildings and vehicles owned by the family to track their value, taxes and documents."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Add a property
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  selected={asset.id === selectedId}
                  taxCount={taxByAsset.get(asset.id)?.length ?? 0}
                  docCount={docsByAsset.get(asset.id)?.length ?? 0}
                  onView={handleView}
                  onEdit={openEdit}
                  onArchive={(a) =>
                    a.status === 'archived'
                      ? updateAsset.mutate({ id: a.id, data: { status: 'active' } })
                      : setArchiveTarget(a)
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Right - detail panel (desktop) */}
        <div className="hidden lg:block">
          <div className="sticky top-20">
            {selected ? (
              <PropertyDetailPanel
                asset={selected}
                taxes={taxByAsset.get(selected.id) ?? []}
                documents={docsByAsset.get(selected.id) ?? []}
                docsById={docsById}
                onEdit={() => openEdit(selected)}
                onAddDocument={() => setUploadFor(selected)}
                onAddTax={() => navigate('/taxes/new')}
                onOpenDetail={() => navigate(`/assets/${selected.id}`)}
                onDownload={handleDownload}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-surface-border bg-white p-8 text-center">
                <Landmark className="mx-auto h-8 w-8 text-slate-500" />
                <p className="mt-3 text-sm font-medium text-slate-700">Select a property</p>
                <p className="mt-1 text-xs text-slate-600">
                  Click any property to see its documents, taxes and payments here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Upload document for a property */}
      <SlideOverDrawer
        open={!!uploadFor}
        onOpenChange={(o) => !o && setUploadFor(null)}
        title="Add document"
        description={uploadFor ? `Upload a document for ${uploadFor.name}` : undefined}
      >
        {uploadFor && (
          <DocumentUploader
            key={uploadFor.id}
            entityType="asset"
            entityId={uploadFor.id}
            defaultCategory="deed"
            onUploaded={() => {
              queryClient.invalidateQueries({ queryKey: ['documents'] });
              setUploadFor(null);
            }}
          />
        )}
      </SlideOverDrawer>

      <ConfirmModal
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title="Archive property?"
        description={`"${archiveTarget?.name}" will be moved to archived. You can restore it later.`}
        confirmLabel="Archive"
        loading={archiveAsset.isPending}
        onConfirm={async () => {
          if (archiveTarget) await archiveAsset.mutateAsync(archiveTarget.id);
          setArchiveTarget(null);
        }}
      />
    </div>
  );
}

interface ByOwnerViewProps {
  groups: [string, Asset[]][];
  isLoading: boolean;
  onView: (asset: Asset) => void;
}

function ByOwnerView({ groups, isLoading, onView }: ByOwnerViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No properties to group"
        description="Properties will appear grouped under each owner here."
      />
    );
  }
  return (
    <div className="space-y-6">
      {groups.map(([owner, assets]) => {
        const total = assets.reduce((s, a) => s + getAssetValue(a), 0);
        return (
          <section key={owner} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-navy text-xs font-semibold text-white">
                {owner === 'Unassigned' ? '-' : getInitials(owner)}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{owner}</h3>
                <p className="text-xs text-slate-600">
                  {assets.length} propert{assets.length === 1 ? 'y' : 'ies'}
                  {total > 0 ? ` · ${formatINR(total)}` : ''}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onView(a)}
                  className="flex items-start gap-3 rounded-xl border border-surface-border bg-white p-4 text-left transition-shadow hover:shadow-sm"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy-muted text-brand-navy">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{a.name}</p>
                    <p className="text-xs capitalize text-slate-600">{a.asset_type}</p>
                    {getAssetValue(a) > 0 && (
                      <p className="mt-0.5 font-mono text-xs text-slate-600">
                        {formatINR(getAssetValue(a))}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

interface PanelProps {
  asset: Asset;
  taxes: Tax[];
  documents: TaxDocument[];
  docsById: Map<string, TaxDocument>;
  onEdit: () => void;
  onAddDocument: () => void;
  onAddTax: () => void;
  onOpenDetail: () => void;
  onDownload: (id: string) => void;
}

function PropertyDetailPanel({
  asset,
  taxes,
  documents,
  docsById,
  onEdit,
  onAddDocument,
  onAddTax,
  onOpenDetail,
  onDownload,
}: PanelProps) {
  const { data: payments = [] } = useEntityPayments(asset.id);
  const owner = getAssetOwner(asset);
  const canEditProperty = useCan('properties.edit');
  const canAddTax = useCan('taxes.create');
  const canAddDocument = useCan('documents.create');

  // Property Details in the canonical order (Owner Name first).
  const shownMeta = getPropertyDetailRows(asset, owner);

  return (
    <div className="space-y-4 rounded-xl border border-surface-border bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">{asset.name}</h3>
        </div>
        <button
          onClick={onOpenDetail}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
        >
          Open <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      <div className="border-t border-surface-border pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Property Details
          </span>
          {canEditProperty && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-navy hover:bg-brand-navy-muted"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          )}
        </div>
        {shownMeta.length > 0 ? (
          <dl className="space-y-1.5 text-xs">
            {shownMeta.map((row) => (
              <div key={row.key} className="flex justify-between gap-3">
                <dt className="text-slate-600">{row.label}</dt>
                <dd className="text-right font-medium text-slate-700">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-slate-600">No property details recorded yet.</p>
        )}
      </div>

      {/* Linked taxes */}
      <div className="border-t border-surface-border pt-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <Receipt className="h-3.5 w-3.5" /> Tax obligations
        </div>
        {taxes.length === 0 ? (
          <p className="text-xs text-slate-600">No taxes linked to this property.</p>
        ) : (
          <ul className="space-y-1.5">
            {taxes.map((t) => {
              const receipt = t.receipt_document_id ? docsById.get(t.receipt_document_id) : null;
              return (
                <li key={t.id} className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-slate-700">{t.description}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  {receipt && (
                    <button
                      onClick={() => onDownload(receipt.id)}
                      className="mt-1 flex items-center gap-1 text-[12px] text-brand-navy hover:underline"
                    >
                      <Download className="h-3 w-3" /> Receipt: {receipt.label}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {canAddTax && (
          <button
            onClick={onAddTax}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-navy hover:underline"
          >
            <Plus className="h-3 w-3" /> Add tax
          </button>
        )}
      </div>

      {/* Linked documents */}
      <div className="border-t border-surface-border pt-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <FileText className="h-3.5 w-3.5" /> Documents
        </div>
        {documents.length === 0 ? (
          <p className="text-xs text-slate-600">No documents uploaded yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs"
              >
                <span className="truncate font-medium text-slate-700">{d.label}</span>
                <button
                  onClick={() => onDownload(d.id)}
                  aria-label={`Download ${d.label}`}
                  className="shrink-0 rounded p-1 text-slate-600 hover:text-brand-navy"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {canAddDocument && (
          <button
            onClick={onAddDocument}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-navy hover:underline"
          >
            <Plus className="h-3 w-3" /> Add document
          </button>
        )}
      </div>

      {/* Recent payments */}
      {payments.length > 0 && (
        <div className="border-t border-surface-border pt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Recent payments
          </div>
          <ul className="space-y-1">
            {payments.slice(0, 3).map((p) => (
              <li key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-700">{formatDate(p.payment_date)}</span>
                <span className="font-mono font-medium text-slate-700">
                  {formatINR(Number(p.amount_paid))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
