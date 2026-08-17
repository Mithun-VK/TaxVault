import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Pencil,
  FileText,
  Download,
  Eye,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { CountdownChip } from '@/components/shared/CountdownChip';
import { EmptyState } from '@/components/shared/EmptyState';
import { AssetLinkedItems } from '@/components/assets/AssetLinkedItems';
import { SlideOverDrawer } from '@/components/shared/SlideOverDrawer';
import { DocumentUploader } from '@/components/shared/DocumentUploader';
import { TaxForm } from '@/components/taxes/TaxForm';
import { PolicyForm } from '@/components/insurance/PolicyForm';
import { PaymentForm } from '@/components/shared/PaymentForm';
import { PaymentRow } from '@/components/payments/PaymentRow';
import { useCan } from '@/hooks/usePermissions';
import { useAsset } from '@/api/assets';
import { useTaxes, useCreateTax } from '@/api/taxes';
import { useInsurancePolicies, useCreateInsurance } from '@/api/insurance';
import { useEntityDocuments, useDownloadUrl, useDeleteDocument, triggerDownload } from '@/api/documents';
import { usePayments } from '@/api/payments';
import { ASSET_TYPES, TAX_TYPES } from '@/utils/constants';
import { getPropertyDetailRows, KNOWN_PROPERTY_KEYS } from '@/utils/propertyFields';
import { getValuationRows, BUILDING_META_KEYS } from '@/utils/buildings';
import {
  goldCategory,
  goldReference,
  goldShop,
  goldBillNumber,
  goldBillDate,
  goldGrams,
  goldValue,
  goldLocatedAt,
  goldPurity,
  goldCount,
} from '@/utils/gold';
import { gramsToSovereigns } from '@/utils/constants';
import {
  docSlotsForType,
  docMatchesSlot,
  ecInfo,
  effectiveDocDate,
  docHalf,
  HALF_LABEL,
  type PropertyDocSlot,
  type ECStatus,
} from '@/utils/propertyDocs';
import { formatINR, getAssetOwner, getAssetTypeColor, getStatusLabel } from '@/utils/formatters';
import { formatDate } from '@/utils/dates';
import { isPropertyType } from '@/types';
import type { TaxDocument } from '@/types';

// Legacy metadata keys no longer surfaced under "Other recorded details" —
// superseded by dedicated Property Details fields (property/water/land tax number).
const HIDDEN_METADATA_KEYS = new Set(['tax_ids', 'tax_id']);

// EC status → badge styling.
const EC_BADGE: Record<ECStatus, { label: string; cls: string }> = {
  valid: { label: 'Valid', cls: 'bg-emerald-50 text-emerald-600' },
  expiring: { label: 'Expiring soon', cls: 'bg-amber-50 text-amber-700' },
  expired: { label: 'Expired', cls: 'bg-red-50 text-brand-danger' },
};

const PREVIEWABLE = /\.(png|jpe?g|webp|gif|pdf)(\?|$)/i;

/** How a single document's date/period reads, per its slot's capture mode. */
function docWhenLabel(doc: TaxDocument, slot: PropertyDocSlot): string {
  if (slot.dateInput === 'fy_half') {
    const half = docHalf(doc);
    const fy = doc.financial_year ? `FY ${doc.financial_year}` : 'FY —';
    return half ? `${fy} · ${half === 'H1' ? '1st half' : '2nd half'}` : fy;
  }
  return formatDate(effectiveDocDate(doc));
}

const TAX_FORM_ID = 'asset-detail-tax-form';
const POLICY_FORM_ID = 'asset-detail-policy-form';

/** What a payment is being recorded against, from this property's page. */
interface PayTarget {
  entityType: 'tax' | 'insurance';
  id: string;
  name: string;
  amount?: number;
}

export function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canEditProperty = useCan('properties.edit');
  const canAddTax = useCan('taxes.create');
  const canAddInsurance = useCan('insurance.create');
  const canLogPayment = useCan('payments.create');
  const { data: asset, isLoading } = useAsset(id);
  const { data: taxes = [] } = useTaxes();
  const { data: policies = [] } = useInsurancePolicies();
  const { data: docs = [] } = useEntityDocuments(id);
  const { data: payments = [] } = usePayments();
  const downloadUrl = useDownloadUrl();
  const deleteDoc = useDeleteDocument();
  const createTax = useCreateTax();
  const createPolicy = useCreateInsurance();
  const [taxOpen, setTaxOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);

  const openAddTax = () => setTaxOpen(true);

  // Upload drawer — `uploadSlot` seeds the label + tag when adding to a slot.
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadSlot, setUploadSlot] = useState<PropertyDocSlot | null>(null);

  const linkedTaxes = useMemo(() => taxes.filter((t) => t.linked_asset_id === id), [taxes, id]);
  // Newest assessment first, matching the payment history below it.
  const sortedLinkedTaxes = useMemo(
    () => [...linkedTaxes].sort((a, b) => b.due_date.localeCompare(a.due_date)),
    [linkedTaxes],
  );
  const linkedPolicies = useMemo(
    () => policies.filter((p) => p.linked_asset_id === id),
    [policies, id],
  );
  const linkedPayments = useMemo(() => {
    const ids = new Set([...linkedTaxes.map((t) => t.id), ...linkedPolicies.map((p) => p.id)]);
    return payments.filter((p) => ids.has(p.entity_id));
  }, [payments, linkedTaxes, linkedPolicies]);

  const taxPayments = useMemo(
    () =>
      linkedPayments
        .filter((p) => p.entity_type === 'tax')
        .sort((a, b) => b.payment_date.localeCompare(a.payment_date)),
    [linkedPayments],
  );

  const handleReceipt = async (docId: string) => {
    const url = await downloadUrl.mutateAsync(docId);
    triggerDownload(url);
  };

  // Preview opens the presigned URL in a new tab (browser renders images/PDFs).
  const handlePreview = async (docId: string) => {
    const url = await downloadUrl.mutateAsync(docId);
    window.open(url, '_blank', 'noopener');
  };

  const openSlotUpload = (slot: PropertyDocSlot | null) => {
    setUploadSlot(slot);
    setUploadOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!asset) {
    return (
      <EmptyState
        title="Asset not found"
        description="This asset may have been removed."
        action={
          <Button onClick={() => navigate('/assets')}>
            <ArrowLeft className="h-4 w-4" /> Back to assets
          </Button>
        }
      />
    );
  }

  const color = getAssetTypeColor(asset.asset_type);
  const typeMeta = ASSET_TYPES.find((t) => t.value === asset.asset_type);
  const owner = getAssetOwner(asset);
  const isProperty = isPropertyType(asset.asset_type);
  const isGold = asset.asset_type === 'gold';

  // Property Details in the canonical order; other assets keep the generic dump.
  const propertyRows = isProperty ? getPropertyDetailRows(asset, owner) : [];
  // Current value (+ auto-recorded as-of date) for buildings + land.
  const buildingRows = isProperty ? getValuationRows(asset) : [];
  const valuationTitle = 'Valuation';
  // Structured gold detail (mirrors the vault's jewel card), value-bearing rows only.
  const goldGramsVal = goldGrams(asset);
  const goldRows: { key: string; label: string; value: string }[] = isGold
    ? (
        [
          ['category', 'Category', goldCategory(asset)],
          ['reference', 'Reference No.', goldReference(asset)],
          ['shop', 'Shop', goldShop(asset)],
          ['bill_number', 'Bill No.', goldBillNumber(asset)],
          ['bill_date', 'Bill Date', goldBillDate(asset) ? formatDate(goldBillDate(asset)!) : undefined],
          ['weight', 'Weight', goldGramsVal ? `${goldGramsVal.toFixed(2)} g` : undefined],
          ['sovereign', 'Sovereign', goldGramsVal ? `${gramsToSovereigns(goldGramsVal).toFixed(3)} sov` : undefined],
          ['purity', 'Purity', goldPurity(asset)],
          ['pieces', 'Pieces', String(goldCount(asset))],
          ['purchased_value', 'Purchased Value', goldValue(asset) ? formatINR(goldValue(asset)) : undefined],
          ['located_at', 'Located At', goldLocatedAt(asset)],
        ] as [string, string, string | undefined][]
      )
        .filter(([, , v]) => v !== undefined && v !== '')
        .map(([key, label, value]) => ({ key, label, value: value as string }))
    : [];
  const genericEntries = Object.entries(asset.metadata ?? {}).filter(
    ([k, v]) => k !== 'owner' && k !== 'owner_name' && v !== undefined && v !== '' && v !== null,
  );
  // Metadata not covered by the canonical / building fields (e.g. lease_note) —
  // surfaced after Property Details so nothing is hidden. Legacy keys superseded
  // by dedicated fields (tax_ids → property/water/land tax numbers) are hidden.
  const extraRows = isProperty
    ? genericEntries
        .filter(
          ([k]) =>
            !KNOWN_PROPERTY_KEYS.has(k) &&
            !BUILDING_META_KEYS.includes(k) &&
            !HIDDEN_METADATA_KEYS.has(k),
        )
        .map(([k, v]) => ({
          key: k,
          label: getStatusLabel(k),
          value: Array.isArray(v) ? v.join(', ') : String(v),
        }))
    : [];
  // Canonical document checklist for this asset type (properties & vehicles).
  const slots = docSlotsForType(asset.asset_type);
  const hasChecklist = slots.length > 0;
  const matchedIds = new Set<string>();
  const slotDocs = slots.map((slot) => {
    const matches = docs
      .filter((d) => docMatchesSlot(d, slot))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    matches.forEach((d) => matchedIds.add(d.id));
    return { slot, matches };
  });
  const otherDocs = docs.filter((d) => !matchedIds.has(d.id));
  const onFile = slotDocs.filter((s) => s.matches.length > 0).length;

  const uploaderKey = uploadSlot?.key ?? 'other';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumbs
          items={[
            { label: 'Properties', to: '/assets' },
            { label: asset.name },
          ]}
        />
        {canEditProperty && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/assets/${asset.id}/edit`)}
          >
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )}
      </div>

      {/* Hero */}
      <Card className="border-l-4 p-6" style={{ borderLeftColor: color }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" style={{ color }}>
                {typeMeta?.label}
              </Badge>
              <StatusBadge status={asset.status} />
              {owner && (
                <Badge variant="outline" className="text-slate-700">
                  Owner: {owner}
                </Badge>
              )}
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{asset.name}</h2>
            <p className="mt-0.5 text-sm text-slate-700">{asset.description}</p>
          </div>
          <div className="flex gap-6 text-right">
            {asset.acquisition_cost > 0 && (
              <div>
                <p className="text-xs text-slate-600">Purchase value</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {formatINR(asset.acquisition_cost)}
                </p>
              </div>
            )}
            {asset.acquisition_date && (
              <div>
                <p className="text-xs text-slate-600">Acquired</p>
                <p className="mt-0.5 text-sm font-medium text-slate-700">
                  {formatDate(asset.acquisition_date)}
                </p>
              </div>
            )}
          </div>
        </div>

        {isProperty ? (
          (propertyRows.length > 0 || buildingRows.length > 0 || extraRows.length > 0) && (
            <div className="mt-6 border-t border-surface-border pt-5">
              {propertyRows.length > 0 && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  {propertyRows.map((row) => (
                    <div key={row.key}>
                      <p className="text-xs text-slate-600">{row.label}</p>
                      <p className="mt-0.5 text-sm font-medium text-slate-800">{row.value}</p>
                    </div>
                  ))}
                </div>
              )}
              {buildingRows.length > 0 && (
                <>
                  <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {valuationTitle}
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                    {buildingRows.map((row) => (
                      <div key={row.key}>
                        <p className="text-xs text-slate-600">{row.label}</p>
                        <p className="mt-0.5 text-sm font-medium text-slate-800">{row.value}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {extraRows.length > 0 && (
                <>
                  <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Other recorded details
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                    {extraRows.map((row) => (
                      <div key={row.key}>
                        <p className="text-xs text-slate-600">{row.label}</p>
                        <p className="mt-0.5 text-sm font-medium text-slate-800">{row.value}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        ) : isGold ? (
          goldRows.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-surface-border pt-5 sm:grid-cols-3">
              {goldRows.map((row) => (
                <div key={row.key}>
                  <p className="text-xs text-slate-600">{row.label}</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">{row.value}</p>
                </div>
              ))}
            </div>
          )
        ) : (
          genericEntries.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-surface-border pt-5 sm:grid-cols-3">
              {genericEntries.map(([key, value]) => (
                <div key={key}>
                  <p className="text-xs text-slate-600">{getStatusLabel(key)}</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </p>
                </div>
              ))}
            </div>
          )
        )}
        {asset.notes && (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{asset.notes}</p>
        )}
      </Card>

      {/* Tabs — Documents & Taxes are the focus for a property */}
      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
          <TabsTrigger value="insurance">Insurance</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        {/* ── Documents ── */}
        <TabsContent value="documents" className="space-y-4">
          {hasChecklist ? (
            <>
              <Card className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {typeMeta?.label} documents
                    </p>
                    <p className="text-xs text-slate-700">
                      The papers this {typeMeta?.label?.toLowerCase()} should keep on file.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-700">
                      {onFile} of {slots.length} on file
                    </span>
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-teal transition-all"
                        style={{ width: `${slots.length ? (onFile / slots.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-surface-border">
                  {slotDocs.map(({ slot, matches }, index) => {
                    const present = matches.length > 0;
                    const isMultiple = !!slot.multiple;
                    // EC status reflects the most recent upload.
                    const ec =
                      slot.expiryMonths && present ? ecInfo(matches[0], slot.expiryMonths) : null;
                    const statusIcon =
                      ec && ec.status !== 'valid' ? (
                        <AlertCircle
                          className={cn(
                            'h-5 w-5 shrink-0',
                            ec.status === 'expired' ? 'text-brand-danger' : 'text-amber-500',
                          )}
                        />
                      ) : present ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-teal" />
                      ) : (
                        <AlertCircle
                          className={cn(
                            'h-5 w-5 shrink-0',
                            slot.required ? 'text-brand-danger' : 'text-amber-500',
                          )}
                        />
                      );
                    return (
                      <div key={slot.key} className="py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[12px] font-semibold tabular-nums text-slate-700">
                              {index + 1}
                            </span>
                            {statusIcon}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-slate-800">{slot.label}</p>
                                {slot.required && (
                                  <span
                                    className={cn(
                                      'rounded-md px-1.5 py-0.5 text-[12px] font-medium',
                                      present
                                        ? 'bg-slate-100 text-slate-700'
                                        : 'bg-brand-danger/10 text-brand-danger',
                                    )}
                                  >
                                    Required
                                  </span>
                                )}
                                {ec && (
                                  <span
                                    className={cn(
                                      'rounded-md px-1.5 py-0.5 text-[12px] font-medium',
                                      EC_BADGE[ec.status].cls,
                                    )}
                                  >
                                    {EC_BADGE[ec.status].label}
                                  </span>
                                )}
                              </div>
                              <p className="flex items-center gap-1 text-xs text-slate-600">
                                {slot.expiryMonths && <Clock className="h-3 w-3" />}
                                {ec
                                  ? `Renew by ${formatDate(ec.expiresAt.toISOString())}${
                                      ec.daysLeft >= 0 ? ` · ${ec.daysLeft} days left` : ' · overdue'
                                    }`
                                  : isMultiple
                                    ? present
                                      ? `${matches.length} ${
                                          slot.dateInput === 'fy_half' || slot.key === 'eb_bill'
                                            ? `receipt${matches.length > 1 ? 's' : ''} · last updated ${docWhenLabel(matches[0], slot)}`
                                            : `file${matches.length > 1 ? 's' : ''} on file`
                                        }`
                                      : 'Missing — upload one or more files'
                                    : present
                                      ? `On file · ${docWhenLabel(matches[0], slot)}`
                                      : slot.required
                                        ? 'Required — not uploaded yet'
                                        : 'Missing — not uploaded yet'}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant={present && !isMultiple ? 'ghost' : 'outline'}
                            size="sm"
                            onClick={() => openSlotUpload(slot)}
                          >
                            <Plus className="h-4 w-4" />
                            {slot.expiryMonths
                              ? 'Add EC'
                              : slot.dateInput === 'fy_half' || slot.key === 'eb_bill'
                                ? 'Add receipt'
                                : isMultiple
                                  ? 'Add file'
                                  : present
                                    ? 'Replace'
                                    : 'Upload'}
                          </Button>
                        </div>

                        {/* Uploaded file(s) — Parent Docs & EC keep their full history */}
                        {present && (
                          <div className="mt-2 space-y-1 pl-8">
                            {matches.map((doc) => {
                              const canPreview =
                                PREVIEWABLE.test(doc.file_name) || PREVIEWABLE.test(doc.mime_type);
                              return (
                                <div
                                  key={doc.id}
                                  className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <FileText className="h-4 w-4 shrink-0 text-brand-danger" />
                                    <span className="truncate text-sm text-slate-700">
                                      {doc.label}
                                    </span>
                                    <span className="shrink-0 text-xs text-slate-600">
                                      {docWhenLabel(doc, slot)}
                                    </span>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-0.5">
                                    {canPreview && (
                                      <button
                                        type="button"
                                        onClick={() => handlePreview(doc.id)}
                                        aria-label={`Preview ${doc.label}`}
                                        className="rounded-md p-1.5 text-slate-700 hover:bg-white hover:text-brand-navy"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleReceipt(doc.id)}
                                      aria-label={`Download ${doc.label}`}
                                      className="rounded-md p-1.5 text-brand-navy hover:bg-white"
                                    >
                                      <Download className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteDoc.mutate(doc.id)}
                                      disabled={deleteDoc.isPending}
                                      aria-label={`Delete ${doc.label}`}
                                      className="rounded-md p-1.5 text-slate-600 hover:bg-white hover:text-brand-danger"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Anything that doesn't fit a standard slot */}
              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Other documents</p>
                  <Button variant="outline" size="sm" onClick={() => openSlotUpload(null)}>
                    <Plus className="h-4 w-4" /> Upload
                  </Button>
                </div>
                {otherDocs.length === 0 ? (
                  <p className="py-2 text-sm text-slate-600">No other documents.</p>
                ) : (
                  <div className="divide-y divide-surface-border">
                    {otherDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-brand-danger" />
                          <span className="truncate text-sm text-slate-700">{doc.label}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReceipt(doc.id)}
                          aria-label={`Download ${doc.label}`}
                          className="shrink-0 rounded-md p-1.5 text-brand-navy hover:bg-slate-100"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          ) : (
            <AssetLinkedItems
              items={docs}
              getKey={(d) => d.id}
              emptyText="No documents linked to this asset."
              onAdd={() => openSlotUpload(null)}
              addLabel="Upload document"
              renderItem={(doc) => (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-brand-danger" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{doc.label}</p>
                      <p className="text-xs text-slate-600">{doc.financial_year}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleReceipt(doc.id)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              )}
            />
          )}
        </TabsContent>

        {/* ── Taxes ── */}
        <TabsContent value="taxes" className="space-y-4">
          {/* Only the taxes actually linked to this property. There is no
              "expected taxes" checklist: which taxes a property owes varies by
              locality and use, so a template invented rows the user never
              created and left them looking unrecorded forever. */}
          <div className="rounded-xl border border-surface-border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Taxes</p>
                <p className="text-xs text-slate-700">
                  Taxes linked to this {typeMeta?.label?.toLowerCase()}.
                </p>
              </div>
              {canAddTax && (
                <Button variant="outline" size="sm" onClick={openAddTax}>
                  <Plus className="h-4 w-4" /> Add tax
                </Button>
              )}
            </div>

            {sortedLinkedTaxes.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                No taxes linked to this {typeMeta?.label?.toLowerCase()} yet.
              </p>
            ) : (
              <div className="mt-1 divide-y divide-surface-border">
                {sortedLinkedTaxes.map((t) => {
                  const meta = TAX_TYPES.find((tt) => tt.value === t.tax_type);
                  const Icon = meta?.icon;
                  return (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${meta?.color}1A`, color: meta?.color }}
                        >
                          {Icon && <Icon className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {t.name || t.description || meta?.label || t.tax_type}
                          </p>
                          <p className="text-xs text-slate-600">
                            {meta?.label ?? t.tax_type} · Due {formatDate(t.due_date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-mono text-sm tabular-nums text-slate-700">
                          {formatINR(Number(t.total_amount))}
                        </span>
                        <StatusBadge status={t.status} />
                        {canLogPayment && t.status !== 'paid' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setPayTarget({
                                entityType: 'tax',
                                id: t.id,
                                name: t.name || t.description,
                                amount: t.total_amount,
                              })
                            }
                          >
                            Record payment
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historical list of taxes paid, each with its receipt for proof */}
          <div className="rounded-xl border border-surface-border bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Tax payment history</p>
            <p className="mb-1 text-xs text-slate-700">
              Every tax payment for this {typeMeta?.label?.toLowerCase()}, with its receipt for proof.
            </p>
            {taxPayments.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-600">
                No tax payments recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-surface-border">
                {taxPayments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <PaymentRow payment={p} onReceipt={handleReceipt} />
                    </div>
                    {!p.receipt_document_id && (
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        No receipt
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Insurance ── */}
        <TabsContent value="insurance">
          <AssetLinkedItems
            items={linkedPolicies}
            getKey={(p) => p.id}
            emptyText="No insurance linked to this asset."
            onAdd={canAddInsurance ? () => setPolicyOpen(true) : undefined}
            addLabel="Add insurance"
            renderItem={(policy) => (
              <div className="flex items-center justify-between gap-3">
                <Link to={`/insurance/${policy.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{policy.provider}</p>
                  <p className="truncate text-xs text-slate-600">{policy.policy_number}</p>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm tabular-nums text-slate-700">
                    {formatINR(policy.premium_amount)}
                  </span>
                  <CountdownChip date={policy.next_premium_date} showIcon={false} />
                  {canLogPayment && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPayTarget({
                          entityType: 'insurance',
                          id: policy.id,
                          name: policy.provider,
                          amount: policy.premium_amount,
                        })
                      }
                    >
                      Record payment
                    </Button>
                  )}
                </div>
              </div>
            )}
          />
        </TabsContent>

        {/* ── Payments ── */}
        <TabsContent value="payments">
          {linkedPayments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-surface-border py-10 text-center text-sm text-slate-600">
              No payments recorded for this asset.
            </div>
          ) : (
            <div className="divide-y divide-surface-border rounded-xl border border-surface-border bg-white px-4">
              {linkedPayments.map((p) => (
                <PaymentRow key={p.id} payment={p} onReceipt={handleReceipt} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <SlideOverDrawer
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        title={uploadSlot ? `Upload ${uploadSlot.label}` : 'Upload document'}
        description={`Attach a document to ${asset.name}`}
      >
        <DocumentUploader
          key={uploaderKey}
          entityType="asset"
          entityId={asset.id}
          defaultCategory={uploadSlot?.category ?? 'other'}
          defaultLabel={uploadSlot ? uploadSlot.label : ''}
          defaultTags={uploadSlot ? [uploadSlot.key] : []}
          dateInput={uploadSlot?.dateInput}
          lockCategory={!!uploadSlot}
          onUploaded={() => setUploadOpen(false)}
        />
      </SlideOverDrawer>

      {/* Add tax — pre-linked to this property, so it also lands on /taxes and
          the dashboard payment calendar (by due date). */}
      <SlideOverDrawer
        open={taxOpen}
        onOpenChange={setTaxOpen}
        title="Add tax"
        description={`Linked to ${asset.name}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setTaxOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form={TAX_FORM_ID} disabled={createTax.isPending}>
              {createTax.isPending ? 'Saving…' : 'Add tax'}
            </Button>
          </>
        }
      >
        <TaxForm
          formId={TAX_FORM_ID}
          defaultAssetId={asset.id}
          onSubmit={async (data) => {
            await createTax.mutateAsync(data);
            setTaxOpen(false);
          }}
        />
      </SlideOverDrawer>

      {/* Add insurance — pre-linked; shows on /insurance and the calendar
          (by next premium date). */}
      <SlideOverDrawer
        open={policyOpen}
        onOpenChange={setPolicyOpen}
        title="Add insurance"
        description={`Linked to ${asset.name}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setPolicyOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form={POLICY_FORM_ID} disabled={createPolicy.isPending}>
              {createPolicy.isPending ? 'Saving…' : 'Add policy'}
            </Button>
          </>
        }
      >
        <PolicyForm
          formId={POLICY_FORM_ID}
          defaultAssetId={asset.id}
          onSubmit={async (data) => {
            await createPolicy.mutateAsync(data);
            setPolicyOpen(false);
          }}
        />
      </SlideOverDrawer>

      {/* Record a payment against one of this property's taxes / policies. */}
      <SlideOverDrawer
        open={!!payTarget}
        onOpenChange={(o) => !o && setPayTarget(null)}
        title="Record payment"
        description={payTarget?.name}
      >
        {payTarget && (
          <PaymentForm
            entityType={payTarget.entityType}
            entityId={payTarget.id}
            entityName={payTarget.name}
            amount={payTarget.amount}
            onSuccess={() => setPayTarget(null)}
            onCancel={() => setPayTarget(null)}
          />
        )}
      </SlideOverDrawer>
    </div>
  );
}
