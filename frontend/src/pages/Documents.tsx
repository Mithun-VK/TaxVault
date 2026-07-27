import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, UploadCloud, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchInput } from '@/components/shared/SearchInput';
import { DocumentGrid } from '@/components/shared/DocumentGrid';
import { DocumentUploader } from '@/components/shared/DocumentUploader';
import { SlideOverDrawer } from '@/components/shared/SlideOverDrawer';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import {
  useDocuments,
  useDeleteDocument,
  useDownloadUrl,
  useUpdateDocument,
  triggerDownload,
} from '@/api/documents';
import { useAssets } from '@/api/assets';
import { useBills } from '@/api/bills';
import { useTaxes } from '@/api/taxes';
import { useInsurancePolicies } from '@/api/insurance';
import { useDebounce } from '@/hooks/useDebounce';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { getAssetOwner, getEntityTypeLabel } from '@/utils/formatters';
import { DOCUMENT_CATEGORIES } from '@/utils/constants';
import { queryClient } from '@/api/client';
import { isPropertyType } from '@/types';
import type {
  Asset,
  DocumentCategory,
  PaymentEntityType,
  TaxDocument,
} from '@/types';

interface EntityOption {
  id: string;
  name: string;
}

// Each entity type carries its own home category so uploads land sensibly.
const ENTITY_TYPES: { value: PaymentEntityType; label: string; category: DocumentCategory }[] = [
  { value: 'asset', label: 'Properties', category: 'deed' },
  { value: 'bill', label: 'Bills', category: 'bill_receipt' },
  { value: 'tax', label: 'Taxes', category: 'tax_receipt' },
  { value: 'insurance', label: 'Insurance', category: 'policy_doc' },
];

function assetLocation(asset: Asset): string | undefined {
  const m = asset.metadata as Record<string, unknown> | null;
  const v =
    (m?.address as string) ??
    (m?.location as string) ??
    [m?.taluk, m?.district].filter(Boolean).join(', ');
  return v && String(v).trim() ? String(v) : undefined;
}

export function Documents() {
  const navigate = useNavigate();
  const { data: documents = [], isLoading } = useDocuments();
  const { data: assets = [] } = useAssets();
  const { data: bills = [] } = useBills();
  const { data: taxes = [] } = useTaxes();
  const { data: policies = [] } = useInsurancePolicies();
  const deleteDoc = useDeleteDocument();
  const updateDoc = useUpdateDocument();
  const downloadUrl = useDownloadUrl();
  const isAdmin = useIsAdmin();

  const [propertyUpload, setPropertyUpload] = useState<Asset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaxDocument | null>(null);
  const [renameTarget, setRenameTarget] = useState<TaxDocument | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query);

  // Options per entity type for the upload picker.
  const optionsByType = useMemo<Record<PaymentEntityType, EntityOption[]>>(() => {
    return {
      asset: assets.map((a) => {
        const owner = getAssetOwner(a);
        return { id: a.id, name: owner ? `${a.name} · ${owner}` : a.name };
      }),
      bill: bills.map((b) => ({ id: b.id, name: b.provider_name || b.bill_type })),
      tax: taxes.map((t) => ({ id: t.id, name: t.description || t.tax_type })),
      insurance: policies.map((p) => ({ id: p.id, name: `${p.provider} · ${p.policy_number}` })),
    };
  }, [assets, bills, taxes, policies]);

  // entity_id -> display name, across every entity type, to label each document.
  const entityName = useMemo(() => {
    const map = new Map<string, string>();
    (Object.keys(optionsByType) as PaymentEntityType[]).forEach((type) => {
      for (const o of optionsByType[type]) map.set(o.id, o.name);
    });
    return map;
  }, [optionsByType]);

  const withNames = useMemo(
    () =>
      documents.map((d) => ({
        ...d,
        entity_name: d.entity_id
          ? entityName.get(d.entity_id) ?? getEntityTypeLabel(d.entity_type ?? 'asset')
          : 'Unfiled',
      })),
    [documents, entityName],
  );

  // ── "All Documents" filtered view ──
  const visibleDocs = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return withNames
      .filter((d) => categoryFilter === 'all' || d.category === categoryFilter)
      .filter(
        (d) =>
          !q ||
          d.label.toLowerCase().includes(q) ||
          (d.entity_name ?? '').toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q)),
      );
  }, [withNames, categoryFilter, debounced]);

  // ── "By Property" — land & buildings, each with its own documents ──
  const properties = useMemo(
    () => assets.filter((a) => isPropertyType(a.asset_type)),
    [assets],
  );
  const docsByAsset = useMemo(() => {
    const m = new Map<string, TaxDocument[]>();
    for (const d of withNames) {
      if (d.entity_type !== 'asset' || !d.entity_id) continue;
      const arr = m.get(d.entity_id) ?? [];
      arr.push(d);
      m.set(d.entity_id, arr);
    }
    return m;
  }, [withNames]);

  const handleDownload = async (doc: TaxDocument) => {
    const url = await downloadUrl.mutateAsync(doc.id);
    triggerDownload(url);
  };

  const startRename = (doc: TaxDocument) => {
    setRenameTarget(doc);
    setRenameValue(doc.label);
  };

  const openUpload = () => navigate('/documents/new');
  const hasAnyEntity = assets.length + bills.length + taxes.length + policies.length > 0;

  const refreshDocs = () => queryClient.invalidateQueries({ queryKey: ['documents'] });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
          <p className="text-sm text-slate-700">
            Every paper in one place — deeds and pattas, bill statements, tax and insurance papers,
            and payment receipts, filed against the property they belong to.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openUpload} disabled={!hasAnyEntity}>
            <Plus className="h-4 w-4" /> Upload document
          </Button>
        )}
      </div>

      <Tabs defaultValue="by-property">
        <TabsList>
          <TabsTrigger value="by-property">By Property</TabsTrigger>
          <TabsTrigger value="all">All Documents</TabsTrigger>
        </TabsList>

        {/* ── TAB 1 — By Property ── */}
        <TabsContent value="by-property">
          {properties.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No properties yet"
              description="Add land or a building first, then file its patta, sale deed and tax receipts here."
            />
          ) : (
            <div className="rounded-xl border border-surface-border bg-white px-4">
              <Accordion type="multiple" className="w-full">
                {properties.map((asset) => {
                  const docs = docsByAsset.get(asset.id) ?? [];
                  const location = assetLocation(asset);
                  return (
                    <AccordionItem key={asset.id} value={asset.id}>
                      <AccordionTrigger>
                        <span className="flex flex-1 items-center gap-3 pr-3 text-left">
                          <span className="font-medium text-slate-800">{asset.name}</span>
                          {location && (
                            <span className="hidden items-center gap-1 text-xs text-slate-600 sm:flex">
                              <MapPin className="h-3 w-3" /> {location}
                            </span>
                          )}
                          <Badge variant="outline" className="ml-auto">
                            {docs.length} doc{docs.length === 1 ? '' : 's'}
                          </Badge>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        {docs.length === 0 ? (
                          isAdmin ? (
                            <button
                              type="button"
                              onClick={() => setPropertyUpload(asset)}
                              className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-surface-border bg-slate-50/50 py-8 text-center transition-colors hover:border-brand-navy/50"
                            >
                              <UploadCloud className="h-7 w-7 text-slate-600" />
                              <p className="mt-2 text-sm font-medium text-slate-600">
                                No documents uploaded
                              </p>
                              <p className="text-xs text-slate-600">
                                Upload patta, sale deed, or tax receipts
                              </p>
                            </button>
                          ) : (
                            <div className="rounded-xl border-2 border-dashed border-surface-border bg-slate-50/50 py-8 text-center">
                              <UploadCloud className="mx-auto h-7 w-7 text-slate-500" />
                              <p className="mt-2 text-sm text-slate-600">No documents uploaded</p>
                            </div>
                          )
                        ) : (
                          <div className="space-y-3">
                            <DocumentGrid
                              documents={docs}
                              view="grid"
                              onDownload={handleDownload}
                              onDelete={isAdmin ? setDeleteTarget : undefined}
                              onRename={isAdmin ? startRename : undefined}
                            />
                            {isAdmin && (
                              <Button variant="outline" size="sm" onClick={() => setPropertyUpload(asset)}>
                                <Plus className="h-4 w-4" /> Upload document for this property
                              </Button>
                            )}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          )}
        </TabsContent>

        {/* ── TAB 2 — All Documents ── */}
        <TabsContent value="all">
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-surface-border bg-white p-3 sm:flex-row sm:items-center">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search documents, entities and tags…"
              className="flex-1"
            />
            <Select
              value={categoryFilter}
              onValueChange={(v) => setCategoryFilter(v as DocumentCategory | 'all')}
            >
              <SelectTrigger aria-label="Filter by category" className="sm:w-56">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {visibleDocs.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No documents yet"
              description={
                hasAnyEntity
                  ? 'Upload deeds, bill statements, tax and insurance papers, or payment receipts.'
                  : 'Add an asset, bill, tax or policy first, then upload its documents here.'
              }
              action={
                hasAnyEntity && isAdmin ? (
                  <Button onClick={openUpload}>
                    <Plus className="h-4 w-4" /> Upload a document
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DocumentGrid
              documents={visibleDocs}
              view="grid"
              onDownload={handleDownload}
              onDelete={isAdmin ? setDeleteTarget : undefined}
              onRename={isAdmin ? startRename : undefined}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Upload for a specific property (By Property tab) */}
      <SlideOverDrawer
        open={!!propertyUpload}
        onOpenChange={(o) => !o && setPropertyUpload(null)}
        title="Upload document"
        description={propertyUpload ? `For ${propertyUpload.name}` : undefined}
      >
        {propertyUpload && (
          <DocumentUploader
            key={propertyUpload.id}
            entityType="asset"
            entityId={propertyUpload.id}
            defaultCategory="deed"
            onUploaded={() => {
              refreshDocs();
              setPropertyUpload(null);
            }}
          />
        )}
      </SlideOverDrawer>

      {/* Rename modal */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename">Label</Label>
            <Input id="rename" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (renameTarget && renameValue.trim()) {
                  await updateDoc.mutateAsync({
                    id: renameTarget.id,
                    data: { label: renameValue.trim() },
                  });
                }
                setRenameTarget(null);
              }}
              disabled={updateDoc.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete document?"
        description={`"${deleteTarget?.label}" will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        loading={deleteDoc.isPending}
        onConfirm={async () => {
          if (deleteTarget) await deleteDoc.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
