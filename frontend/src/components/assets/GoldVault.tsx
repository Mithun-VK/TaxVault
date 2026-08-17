import { useMemo, useState } from 'react';
import {
  Gem,
  Coins,
  Scale,
  Wallet,
  Plus,
  FolderPlus,
  ChevronRight,
  ArrowLeft,
  MoreVertical,
  Eye,
  Pencil,
  Archive,
  Trash2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { SummaryStatCard } from '@/components/shared/SummaryStatCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { AddGoldCategoryDialog } from './AddGoldCategoryDialog';
import { formatINR } from '@/utils/formatters';
import { formatDate } from '@/utils/dates';
import { gramsToSovereigns } from '@/utils/constants';
import {
  goldSummary,
  goldCategory,
  goldCount,
  goldGrams,
  goldPurity,
  goldReference,
  goldShop,
  goldBillNumber,
  goldBillDate,
  goldValue,
  goldLocatedAt,
  allGoldCategories,
  type GoldCategoryStat,
} from '@/utils/gold';
import { useGoldCategories, useDeleteGoldCategory } from '@/api/goldCategories';
import type { Asset } from '@/types';

const GOLD = '#C8860D';

interface GoldVaultProps {
  assets: Asset[];
  isLoading: boolean;
  /** May add a jewel to a category. */
  canAddGold: boolean;
  /** May edit or archive an existing jewel. */
  canEditGold: boolean;
  /** May create a custom gold category. */
  canAddCategory: boolean;
  /** May delete an empty custom category. */
  canDeleteCategory: boolean;
  onView: (a: Asset) => void;
  onEdit: (a: Asset) => void;
  onArchive: (a: Asset) => void;
  /** Open the create-gold drawer, pre-selecting the given category. */
  onAddGold: (category: string) => void;
}

export function GoldVault({
  assets,
  isLoading,
  canAddGold,
  canEditGold,
  canAddCategory,
  canDeleteCategory,
  onView,
  onEdit,
  onArchive,
  onAddGold,
}: GoldVaultProps) {
  const { data: custom = [] } = useGoldCategories();
  const deleteCategory = useDeleteGoldCategory();
  const [active, setActive] = useState<string | null>(null);
  const [addCatOpen, setAddCatOpen] = useState(false);

  const defs = useMemo(() => allGoldCategories(assets, custom), [assets, custom]);
  // Only user-created (DB-backed) categories can be deleted — map slug → id.
  const deletableId = useMemo(
    () => new Map(custom.map((c) => [c.value, c.id])),
    [custom],
  );
  const { categories, totals } = useMemo(() => goldSummary(assets, defs), [assets, defs]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const activeCat = active ? categories.find((c) => c.key === active) : null;

  // ── Single category — detailed jewel list ──
  if (activeCat) {
    const items = [...activeCat.items].sort((a, b) => goldGrams(b) - goldGrams(a));
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setActive(null)}
          className="inline-flex cursor-pointer items-center gap-1 text-sm text-slate-700 hover:text-brand-navy"
        >
          <ArrowLeft className="h-4 w-4" /> All categories
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${GOLD}1A`, color: GOLD }}
            >
              <Gem className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{activeCat.label}</h2>
              <p className="text-sm text-slate-700">
                {activeCat.pieces} jewel{activeCat.pieces === 1 ? '' : 's'} ·{' '}
                {activeCat.grams.toFixed(2)} g · {activeCat.sovereigns.toFixed(3)} sov
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeCat.value > 0 && (
              <div className="text-right">
                <p className="text-xs text-slate-600">Purchased value</p>
                <p className="font-mono text-sm font-semibold text-slate-800">
                  {formatINR(activeCat.value)}
                </p>
              </div>
            )}
            {canAddGold && (
              <Button onClick={() => onAddGold(activeCat.key)}>
                <Plus className="h-4 w-4" /> Add gold
              </Button>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Gem}
            title={`No ${activeCat.label.toLowerCase()} yet`}
            description="Add a jewel to this category to record its weight, value and documents."
            action={
              canAddGold ? (
                <Button onClick={() => onAddGold(activeCat.key)}>
                  <Plus className="h-4 w-4" /> Add gold
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {items.map((a) => (
              <JewelCard
                key={a.id}
                asset={a}
                canEdit={canEditGold}
                onView={onView}
                onEdit={onEdit}
                onArchive={onArchive}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Landing — totals + category buttons ──
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryStatCard label="Total jewels" value={String(totals.pieces)} icon={Gem} accent="warning" />
        <SummaryStatCard label="Total weight" value={`${totals.grams.toFixed(1)} g`} icon={Scale} accent="navy" />
        <SummaryStatCard
          label="In sovereigns"
          value={`${totals.sovereigns.toFixed(2)} sov`}
          sublabel="1 sovereign = 8 g"
          icon={Coins}
          accent="teal"
        />
        <SummaryStatCard
          label="Est. value"
          value={totals.value ? formatINR(totals.value) : '—'}
          icon={Wallet}
          accent="slate"
        />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Gold categories</h2>
            <p className="text-sm text-slate-700">Choose a category to view or add its jewels.</p>
          </div>
          {canAddCategory && (
            <Button variant="outline" onClick={() => setAddCatOpen(true)}>
              <FolderPlus className="h-4 w-4" /> Add category
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const id = deletableId.get(c.key);
            // Deletable only when it's a user-created category with no jewels
            // (protects populated categories from orphaning their items).
            const onDelete =
              canDeleteCategory && id && c.pieces === 0
                ? () => deleteCategory.mutate(id)
                : undefined;
            return (
              <CategoryButton
                key={c.key}
                stat={c}
                onClick={() => setActive(c.key)}
                onDelete={onDelete}
              />
            );
          })}
        </div>
      </section>

      <AddGoldCategoryDialog open={addCatOpen} onOpenChange={setAddCatOpen} onAdded={() => {}} />
    </div>
  );
}

function CategoryButton({
  stat,
  onClick,
  onDelete,
}: {
  stat: GoldCategoryStat;
  onClick: () => void;
  /** Present only for deletable (empty, user-created) categories. */
  onDelete?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group cursor-pointer text-left"
      aria-label={`View ${stat.label}`}
    >
      <Card className="relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1 opacity-70 transition-opacity duration-200 group-hover:opacity-100"
          style={{ backgroundColor: GOLD }}
        />
        <div className="flex items-center justify-between">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${GOLD}1A`, color: GOLD }}
          >
            <Gem className="h-5 w-5" />
          </span>
          <div className="flex items-center gap-1">
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                aria-label={`Delete ${stat.label} category`}
                title="Delete category"
                className="rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <ChevronRight className="h-5 w-5 text-slate-500 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-navy" />
          </div>
        </div>
        <h3 className="mt-3 font-semibold text-slate-900">{stat.label}</h3>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-surface-border pt-3 text-center">
          <MiniStat label="Jewels" value={String(stat.pieces)} />
          <MiniStat label="Grams" value={stat.grams.toFixed(1)} />
          <MiniStat label="Sovereigns" value={stat.sovereigns.toFixed(2)} />
        </div>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-base font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="text-[12px] uppercase tracking-wide text-slate-600">{label}</p>
    </div>
  );
}

function JewelCard({
  asset,
  canEdit,
  onView,
  onEdit,
  onArchive,
}: {
  asset: Asset;
  canEdit: boolean;
  onView: (a: Asset) => void;
  onEdit: (a: Asset) => void;
  onArchive: (a: Asset) => void;
}) {
  const grams = goldGrams(asset);
  const billDate = goldBillDate(asset);

  const rows: { label: string; value: string }[] = [
    { label: 'Reference No.', value: goldReference(asset) ?? '—' },
    { label: 'Shop', value: goldShop(asset) ?? '—' },
    { label: 'Bill No.', value: goldBillNumber(asset) ?? '—' },
    { label: 'Bill Date', value: billDate ? formatDate(billDate) : '—' },
    { label: 'Weight', value: `${grams.toFixed(2)} g` },
    { label: 'Sovereign', value: `${gramsToSovereigns(grams).toFixed(3)} sov` },
    { label: 'Purchased Value', value: goldValue(asset) ? formatINR(goldValue(asset)) : '—' },
    { label: 'Located At', value: goldLocatedAt(asset) ?? '—' },
    { label: 'Purity', value: goldPurity(asset) ?? '—' },
    { label: 'Pieces', value: String(goldCount(asset)) },
  ];

  return (
    <div
      onClick={() => onView(asset)}
      className="group flex cursor-pointer flex-col rounded-xl border border-l-4 border-surface-border bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
      style={{ borderLeftColor: GOLD }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{asset.name}</h3>
          <p className="mt-0.5 text-xs capitalize text-slate-600">{goldCategory(asset)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={asset.status} />
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Gold item actions"
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
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-surface-border pt-3 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-[12px] uppercase tracking-wide text-slate-600">{row.label}</dt>
            <dd className="truncate text-sm font-medium text-slate-800">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
