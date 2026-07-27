import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Building2,
  Receipt,
  Shield,
  AlertTriangle,
  Link2,
  Pencil,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { SearchInput } from '@/components/shared/SearchInput';
import { IdentityDocUploader } from '@/components/individuals/IdentityDocUploader';
import {
  useIndividual,
  useIndividualAssets,
  useCreateIndividual,
  useUpdateIndividual,
  useArchiveIndividual,
} from '@/api/individuals';
import { useAssets, useUpdateAsset, useCreateAsset } from '@/api/assets';
import { useTaxes, useCreateTax } from '@/api/taxes';
import { useInsurancePolicies } from '@/api/insurance';
import { TaxForm } from '@/components/taxes/TaxForm';
import { AssetForm } from '@/components/assets/AssetForm';
import { SlideOverDrawer } from '@/components/shared/SlideOverDrawer';
import { queryClient } from '@/api/client';
import { individualKeys } from '@/api/individuals';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { RELATIONSHIP_OPTIONS, VISA_TYPES } from '@/utils/constants';
import { getInitials, formatINR } from '@/utils/formatters';
import { toInputDate, formatDate, daysUntil } from '@/utils/dates';
import { cn } from '@/lib/utils';
import type { Asset, Individual, IndividualCreate, Tax, VisaEntry } from '@/types';

const INDIVIDUAL_TAX_FORM_ID = 'individual-tax-form';
const EDIT_INDIVIDUAL_FORM_ID = 'individual-edit-form';
const INDIVIDUAL_ASSET_FORM_ID = 'individual-asset-form';

// ── Profile tab / create form ────────────────────────────────────────────────

interface ProfileFields {
  full_name: string;
  date_of_birth: string;
  relationship_to_owner: string;
  phone_number: string;
  email: string;
  address: string;
  aadhaar_number: string;
  pan_number: string;
  passport_number: string;
  passport_expiry: string;
}

function toFields(ind?: Individual): ProfileFields {
  return {
    full_name: ind?.full_name ?? '',
    date_of_birth: ind?.date_of_birth ? toInputDate(ind.date_of_birth) : '',
    relationship_to_owner: ind?.relationship_to_owner ?? '',
    phone_number: ind?.phone_number ?? '',
    email: ind?.email ?? '',
    address: ind?.address ?? '',
    aadhaar_number: ind?.aadhaar_number ?? '',
    pan_number: ind?.pan_number ?? '',
    passport_number: ind?.passport_number ?? '',
    passport_expiry: ind?.passport_expiry ? toInputDate(ind.passport_expiry) : '',
  };
}

function cleanPayload(f: ProfileFields): IndividualCreate {
  return {
    full_name: f.full_name.trim(),
    date_of_birth: f.date_of_birth || undefined,
    relationship_to_owner: f.relationship_to_owner || undefined,
    phone_number: f.phone_number || undefined,
    email: f.email || undefined,
    address: f.address || undefined,
    aadhaar_number: f.aadhaar_number.trim() || undefined,
    pan_number: f.pan_number.trim().toUpperCase() || undefined,
    passport_number: f.passport_number.trim() || undefined,
    passport_expiry: f.passport_expiry || undefined,
  };
}

function ageFrom(dob?: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 200 ? age : null;
}

/**
 * Hero summary — mirrors the Property Details hero (accent border, badge row,
 * name, and a labelled detail grid), so a person and a property read the same.
 */
function IndividualHero({ individual }: { individual: Individual }) {
  const age = ageFrom(individual.date_of_birth);
  const passportDays = individual.passport_expiry ? daysUntil(individual.passport_expiry) : null;

  const rows: { label: string; value: string }[] = [
    {
      label: 'Date of birth',
      value: individual.date_of_birth
        ? `${formatDate(individual.date_of_birth)}${age !== null ? ` · ${age} yrs` : ''}`
        : '—',
    },
    { label: 'Phone', value: individual.phone_number ?? '—' },
    { label: 'Email', value: individual.email ?? '—' },
    { label: 'Address', value: individual.address ?? '—' },
    { label: 'Aadhaar', value: individual.aadhaar_number ?? '—' },
    { label: 'PAN', value: individual.pan_number ?? '—' },
    { label: 'Passport', value: individual.passport_number ?? '—' },
    {
      label: 'Passport expiry',
      value: individual.passport_expiry ? formatDate(individual.passport_expiry) : '—',
    },
  ];

  return (
    <Card className="border-l-4 p-6" style={{ borderLeftColor: '#1A3C6E' }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-brand-navy text-xl text-white">
              {getInitials(individual.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {individual.relationship_to_owner && (
                <Badge variant="outline" className="text-slate-700">
                  {individual.relationship_to_owner}
                </Badge>
              )}
              {individual.active_visa_count > 0 && (
                <Badge variant="outline" className="text-slate-700">
                  {individual.active_visa_count} active visa
                  {individual.active_visa_count === 1 ? '' : 's'}
                </Badge>
              )}
              {individual.has_expiring_docs && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <AlertTriangle className="h-3 w-3" /> Docs expiring
                </span>
              )}
              {individual.is_archived && (
                <Badge variant="outline" className="text-slate-600">
                  Archived
                </Badge>
              )}
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {individual.full_name}
            </h2>
            <p className="mt-0.5 text-sm text-slate-700">
              {individual.relationship_to_owner ?? 'Family member'}
            </p>
          </div>
        </div>
        {individual.created_at && (
          <div className="text-right">
            <p className="text-xs text-slate-600">Added</p>
            <p className="mt-0.5 text-sm font-medium text-slate-700">
              {formatDate(individual.created_at)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-surface-border pt-5 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label}>
            <p className="text-xs text-slate-600">{row.label}</p>
            <p className="mt-0.5 break-words text-sm font-medium text-slate-800">{row.value}</p>
          </div>
        ))}
      </div>

      {passportDays !== null && passportDays <= 90 && (
        <div
          className={cn(
            'mt-4 flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium',
            passportDays < 30 ? 'bg-red-50 text-brand-danger' : 'bg-amber-50 text-amber-700',
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {passportDays < 0
            ? 'Passport has expired — renew immediately'
            : `Passport expires in ${passportDays} days — renew soon`}
        </div>
      )}

      {individual.notes && (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {individual.notes}
        </p>
      )}
    </Card>
  );
}

/** Personal-details form used inside the Edit drawer. */
function EditIndividualForm({
  individual,
  formId,
  onSubmit,
}: {
  individual: Individual;
  formId: string;
  onSubmit: (data: IndividualCreate) => Promise<void> | void;
}) {
  const [fields, setFields] = useState<ProfileFields>(() => toFields(individual));
  const set = (k: keyof ProfileFields, v: string) => setFields((f) => ({ ...f, [k]: v }));

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        if (fields.full_name.trim()) onSubmit(cleanPayload(fields));
      }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <Field label="Full name" required className="sm:col-span-2">
        <Input value={fields.full_name} onChange={(e) => set('full_name', e.target.value)} />
      </Field>
      <Field label="Date of birth">
        <Input
          type="date"
          value={fields.date_of_birth}
          onChange={(e) => set('date_of_birth', e.target.value)}
        />
      </Field>
      <Field label="Relationship to owner">
        <Select
          value={fields.relationship_to_owner || undefined}
          onValueChange={(v) => set('relationship_to_owner', v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select relationship" />
          </SelectTrigger>
          <SelectContent>
            {RELATIONSHIP_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Phone number">
        <Input value={fields.phone_number} onChange={(e) => set('phone_number', e.target.value)} />
      </Field>
      <Field label="Email">
        <Input type="email" value={fields.email} onChange={(e) => set('email', e.target.value)} />
      </Field>
      <Field label="Address" className="sm:col-span-2">
        <Textarea rows={2} value={fields.address} onChange={(e) => set('address', e.target.value)} />
      </Field>

      <div className="sm:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Identity documents
        </p>
      </div>
      <Field label="Aadhaar number">
        <Input
          value={fields.aadhaar_number}
          placeholder="12 digits"
          onChange={(e) => set('aadhaar_number', e.target.value)}
        />
      </Field>
      <Field label="PAN number">
        <Input
          value={fields.pan_number}
          placeholder="ABCDE1234F"
          onChange={(e) => set('pan_number', e.target.value.toUpperCase())}
        />
      </Field>
      <Field label="Passport number">
        <Input
          value={fields.passport_number}
          placeholder="e.g. Z1234567"
          onChange={(e) => set('passport_number', e.target.value)}
        />
      </Field>
      <Field label="Passport expiry">
        <Input
          type="date"
          value={fields.passport_expiry}
          onChange={(e) => set('passport_expiry', e.target.value)}
        />
      </Field>
    </form>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label>
        {label}
        {required && <span className="text-brand-danger"> *</span>}
      </Label>
      {children}
    </div>
  );
}

// ── Documents tab ────────────────────────────────────────────────────────────

function DocumentsTab({ individual, readOnly }: { individual: Individual; readOnly: boolean }) {
  const update = useUpdateIndividual();
  const [aadhaar, setAadhaar] = useState(individual.aadhaar_number ?? '');
  const [pan, setPan] = useState(individual.pan_number ?? '');
  const [passport, setPassport] = useState(individual.passport_number ?? '');
  const [passportExpiry, setPassportExpiry] = useState(
    individual.passport_expiry ? toInputDate(individual.passport_expiry) : '',
  );
  const passportDays = individual.passport_expiry ? daysUntil(individual.passport_expiry) : null;

  const saveKey = (patch: Record<string, string | undefined>) =>
    update.mutate({ id: individual.id, ...patch });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <DocSection title="Aadhaar Card">
        <IdentityDocUploader
          individualId={individual.id}
          docType="aadhaar"
          label="Aadhaar"
          currentUrl={individual.aadhaar_photo_url}
          onComplete={(key) => saveKey({ aadhaar_photo_key: key })}
        />
        <NumberField
          label="Aadhaar number"
          value={aadhaar}
          display={individual.aadhaar_number ?? '—'}
          placeholder="12 digits"
          readOnly={readOnly}
          onChange={setAadhaar}
          onSave={() => saveKey({ aadhaar_number: aadhaar || undefined })}
        />
      </DocSection>

      <DocSection title="PAN Card">
        <IdentityDocUploader
          individualId={individual.id}
          docType="pan"
          label="PAN"
          currentUrl={individual.pan_photo_url}
          onComplete={(key) => saveKey({ pan_photo_key: key })}
        />
        <NumberField
          label="PAN number"
          value={pan}
          display={individual.pan_number ?? '—'}
          placeholder="ABCDE1234F"
          readOnly={readOnly}
          uppercase
          onChange={setPan}
          onSave={() => saveKey({ pan_number: pan ? pan.toUpperCase() : undefined })}
        />
      </DocSection>

      <DocSection title="Passport">
        <IdentityDocUploader
          individualId={individual.id}
          docType="passport"
          label="Passport"
          currentUrl={individual.passport_photo_url}
          onComplete={(key) => saveKey({ passport_photo_key: key })}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Passport number"
            value={passport}
            display={individual.passport_number ?? '—'}
            placeholder="e.g. Z1234567"
            readOnly={readOnly}
            onChange={setPassport}
            onSave={() => saveKey({ passport_number: passport || undefined })}
          />
          <Field label="Expiry date">
            <Input
              type="date"
              value={passportExpiry}
              disabled={readOnly}
              onChange={(e) => setPassportExpiry(e.target.value)}
              onBlur={() => saveKey({ passport_expiry: passportExpiry || undefined })}
            />
          </Field>
        </div>
        {passportDays !== null && passportDays <= 90 && (
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium',
              passportDays < 30 ? 'bg-red-50 text-brand-danger' : 'bg-amber-50 text-amber-700',
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {passportDays < 0
              ? 'Passport has expired — renew immediately'
              : `Passport expires in ${passportDays} days — renew soon`}
          </div>
        )}
      </DocSection>
    </div>
  );
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-surface-border bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  display,
  placeholder,
  readOnly,
  uppercase,
  onChange,
  onSave,
}: {
  label: string;
  value: string;
  display: string;
  placeholder?: string;
  readOnly: boolean;
  uppercase?: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  const [editing, setEditing] = useState(false);
  if (readOnly || !editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-slate-600">{label}</p>
          <p className="font-mono text-sm text-slate-800">{display}</p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded p-1 text-slate-600 hover:text-brand-navy"
            aria-label={`Edit ${label}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
        />
        <Button
          size="sm"
          onClick={() => {
            onSave();
            setEditing(false);
          }}
        >
          Save
        </Button>
      </div>
    </Field>
  );
}

// ── Properties tab ───────────────────────────────────────────────────────────

function PropertiesTab({ individual, readOnly }: { individual: Individual; readOnly: boolean }) {
  const navigate = useNavigate();
  const { data, isLoading } = useIndividualAssets(individual.id);
  const assets = data?.items ?? [];
  const [linkOpen, setLinkOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const createAsset = useCreateAsset();

  const totalValue = useMemo(
    () => assets.reduce((sum, a) => sum + (Number(a.current_value) || 0), 0),
    [assets],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{assets.length}</span> properties ·{' '}
          <span className="font-semibold text-slate-900">{formatINR(totalValue)}</span> total value
        </p>
        {!readOnly && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
              <Link2 className="h-4 w-4" /> Link existing
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add property
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-border bg-white p-8 text-center text-sm text-slate-600">
          No properties linked to {individual.full_name} yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {assets.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => navigate(`/assets/${a.id}`)}
              className="flex items-start gap-3 rounded-xl border border-surface-border bg-white p-4 text-left transition-shadow hover:shadow-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy-muted text-brand-navy">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{a.name}</p>
                <p className="text-xs capitalize text-slate-600">{a.asset_type}</p>
                {a.current_value > 0 && (
                  <p className="mt-0.5 font-mono text-xs text-slate-600">
                    {formatINR(Number(a.current_value))}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <LinkPropertyDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        individual={individual}
        linkedIds={new Set(assets.map((a) => a.id))}
      />

      {/* Create a property linked to this individual — stays on this page. */}
      <SlideOverDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add property"
        description={`Register a new property for ${individual.full_name}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form={INDIVIDUAL_ASSET_FORM_ID} disabled={createAsset.isPending}>
              {createAsset.isPending ? 'Saving…' : 'Create property'}
            </Button>
          </>
        }
      >
        <AssetForm
          formId={INDIVIDUAL_ASSET_FORM_ID}
          onSubmit={async (payload) => {
            await createAsset.mutateAsync({ ...payload, individual_id: individual.id });
            queryClient.invalidateQueries({ queryKey: individualKeys.assets(individual.id) });
            queryClient.invalidateQueries({ queryKey: individualKeys.lists() });
            setAddOpen(false);
          }}
        />
      </SlideOverDrawer>
    </div>
  );
}

function LinkPropertyDialog({
  open,
  onOpenChange,
  individual,
  linkedIds,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  individual: Individual;
  linkedIds: Set<string>;
}) {
  const { data: allAssets = [] } = useAssets();
  const updateAsset = useUpdateAsset();
  const [search, setSearch] = useState('');

  const candidates = allAssets.filter(
    (a) =>
      !linkedIds.has(a.id) &&
      a.status !== 'archived' &&
      a.name.toLowerCase().includes(search.toLowerCase()),
  );

  const link = async (asset: Asset) => {
    // Set owner_name too — the owner shown everywhere (getAssetOwner) reads that
    // column, not individual_id, so linking alone wouldn't update the display.
    await updateAsset.mutateAsync({
      id: asset.id,
      data: { individual_id: individual.id, owner_name: individual.full_name },
    });
    queryClient.invalidateQueries({ queryKey: individualKeys.assets(individual.id) });
    queryClient.invalidateQueries({ queryKey: individualKeys.lists() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link a property to {individual.full_name}</DialogTitle>
        </DialogHeader>
        <SearchInput value={search} onChange={setSearch} placeholder="Search properties…" />
        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-600">No properties to link.</p>
          ) : (
            candidates.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => link(a)}
                disabled={updateAsset.isPending}
                className="flex w-full items-center justify-between rounded-lg border border-surface-border px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <span className="min-w-0 truncate font-medium text-slate-700">{a.name}</span>
                <span className="flex items-center gap-1 text-xs text-brand-navy">
                  <Link2 className="h-3.5 w-3.5" /> Link
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Financials tab ───────────────────────────────────────────────────────────

function TaxList({ items }: { items: Tax[] }) {
  return (
    <ul className="divide-y divide-surface-border">
      {items.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="min-w-0 truncate text-slate-700">{t.description}</span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="font-mono text-slate-600">{formatINR(Number(t.total_amount))}</span>
            <StatusBadge status={t.status} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function FinancialsTab({
  individual,
  readOnly,
}: {
  individual: Individual;
  readOnly: boolean;
}) {
  const { data: taxes = [] } = useTaxes();
  const { data: policies = [] } = useInsurancePolicies();
  const createTax = useCreateTax();
  const [taxOpen, setTaxOpen] = useState(false);

  // Only the person's own taxes and policies — anything tied to a property or
  // vehicle lives on that asset, not on the person.
  const personalTaxes = taxes.filter((t) => t.individual_id === individual.id);
  const myPolicies = policies.filter((p) => p.linked_individual_id === individual.id);

  const pending = personalTaxes
    .filter((t) => t.status !== 'paid' && t.status !== 'exempt')
    .reduce((s, t) => s + (Number(t.total_amount) || 0), 0);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-surface-border bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Receipt className="h-4 w-4" /> Tax obligations
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-700">
              Pending:{' '}
              <span className="font-mono font-medium text-slate-800">{formatINR(pending)}</span>
            </span>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={() => setTaxOpen(true)}>
                <Plus className="h-4 w-4" /> Add tax
              </Button>
            )}
          </div>
        </div>

        {/* Personal — income tax, professional tax, … (property taxes belong to
            the property, not the person, so they're intentionally excluded). */}
        {personalTaxes.length === 0 ? (
          <p className="text-sm text-slate-600">
            No personal taxes recorded for {individual.full_name}.
          </p>
        ) : (
          <TaxList items={personalTaxes} />
        )}
      </section>

      {/* Add a personal tax — stored against this individual. */}
      <SlideOverDrawer
        open={taxOpen}
        onOpenChange={setTaxOpen}
        title="Add tax"
        description={`Personal tax for ${individual.full_name}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setTaxOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form={INDIVIDUAL_TAX_FORM_ID} disabled={createTax.isPending}>
              {createTax.isPending ? 'Saving…' : 'Add tax'}
            </Button>
          </>
        }
      >
        <TaxForm
          formId={INDIVIDUAL_TAX_FORM_ID}
          defaultType="income_tax"
          defaultIndividualId={individual.id}
          onSubmit={async (data) => {
            await createTax.mutateAsync(data);
            setTaxOpen(false);
          }}
        />
      </SlideOverDrawer>

      <section className="rounded-xl border border-surface-border bg-white p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Shield className="h-4 w-4" /> Insurance policies
        </h3>
        {myPolicies.length === 0 ? (
          <p className="text-sm text-slate-600">
            No personal policies recorded for {individual.full_name}.
          </p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {myPolicies.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-slate-700">
                  {p.provider} ·{' '}
                  <span className="capitalize text-slate-600">{p.insurance_type}</span>
                </span>
                <span className="shrink-0 font-mono text-slate-600">
                  {formatINR(Number(p.premium_amount))}
                  {p.next_premium_date ? ` · ${formatDate(p.next_premium_date)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Visas tab ────────────────────────────────────────────────────────────────

const BLANK_VISA: VisaEntry = { country: '', visa_type: 'Tourist' };

function VisasTab({ individual, readOnly }: { individual: Individual; readOnly: boolean }) {
  const update = useUpdateIndividual();
  const [visas, setVisas] = useState<VisaEntry[]>(individual.visas ?? []);
  const [dirty, setDirty] = useState(false);

  const change = (next: VisaEntry[]) => {
    setVisas(next);
    setDirty(true);
  };

  const save = () => {
    update.mutate({ id: individual.id, visas }, { onSuccess: () => setDirty(false) });
  };

  const status = (v: VisaEntry): { label: string; tone: string } => {
    if (!v.expiry_date) return { label: 'Active', tone: 'bg-emerald-50 text-emerald-600' };
    const d = daysUntil(v.expiry_date);
    if (d < 0) return { label: 'Expired', tone: 'bg-red-50 text-brand-danger' };
    if (d < 30) return { label: `Expiring · ${d}d`, tone: 'bg-amber-50 text-amber-700' };
    return { label: 'Active', tone: 'bg-emerald-50 text-emerald-600' };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Active visas</h3>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={() => change([...visas, { ...BLANK_VISA }])}>
            <Plus className="h-4 w-4" /> Add visa
          </Button>
        )}
      </div>

      {visas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-border bg-white p-8 text-center text-sm text-slate-600">
          No visas recorded.
        </div>
      ) : (
        <div className="space-y-3">
          {visas.map((v, i) => {
            const st = status(v);
            const upd = (patch: Partial<VisaEntry>) =>
              change(visas.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
            return (
              <div key={i} className="rounded-xl border border-surface-border bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={cn(
                      'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                      st.tone,
                    )}
                  >
                    {st.label}
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => change(visas.filter((_, idx) => idx !== i))}
                      className="rounded p-1 text-slate-600 hover:text-brand-danger"
                      aria-label="Remove visa"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Country">
                    <Input
                      value={v.country}
                      disabled={readOnly}
                      onChange={(e) => upd({ country: e.target.value })}
                    />
                  </Field>
                  <Field label="Visa type">
                    <Select
                      value={v.visa_type || undefined}
                      disabled={readOnly}
                      onValueChange={(val) => upd({ visa_type: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {VISA_TYPES.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Visa number">
                    <Input
                      value={v.visa_number ?? ''}
                      disabled={readOnly}
                      onChange={(e) => upd({ visa_number: e.target.value })}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Issue date">
                      <Input
                        type="date"
                        value={v.issue_date ? toInputDate(v.issue_date) : ''}
                        disabled={readOnly}
                        onChange={(e) => upd({ issue_date: e.target.value })}
                      />
                    </Field>
                    <Field label="Expiry date">
                      <Input
                        type="date"
                        value={v.expiry_date ? toInputDate(v.expiry_date) : ''}
                        disabled={readOnly}
                        onChange={(e) => upd({ expiry_date: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && dirty && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save visas'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── New individual create form ───────────────────────────────────────────────

function CreateIndividual() {
  const navigate = useNavigate();
  const create = useCreateIndividual();
  const [fields, setFields] = useState<ProfileFields>(() => toFields());
  const set = (k: keyof ProfileFields, v: string) => setFields((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!fields.full_name.trim()) return;
    const created = await create.mutateAsync(cleanPayload(fields));
    navigate(`/individual/${created.id}`, { replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button
        onClick={() => navigate('/individual')}
        className="flex items-center gap-1 text-sm text-slate-700 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to individuals
      </button>
      <div className="rounded-xl border border-surface-border bg-white p-5">
        <h1 className="mb-4 text-lg font-semibold text-slate-900">Add individual</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" required className="sm:col-span-2">
            <Input value={fields.full_name} onChange={(e) => set('full_name', e.target.value)} />
          </Field>
          <Field label="Date of birth">
            <Input
              type="date"
              value={fields.date_of_birth}
              onChange={(e) => set('date_of_birth', e.target.value)}
            />
          </Field>
          <Field label="Relationship to owner">
            <Select
              value={fields.relationship_to_owner || undefined}
              onValueChange={(v) => set('relationship_to_owner', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select relationship" />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Phone number">
            <Input value={fields.phone_number} onChange={(e) => set('phone_number', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={fields.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={fields.address}
              onChange={(e) => set('address', e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate('/individual')}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending || !fields.full_name.trim()}>
            {create.isPending ? 'Creating…' : 'Create individual'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function IndividualDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const isNew = !id || id === 'new';

  const { data: individual, isLoading } = useIndividual(isNew ? undefined : id);
  const archive = useArchiveIndividual();
  const update = useUpdateIndividual();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (isNew) return <CreateIndividual />;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!individual) {
    return (
      <div className="rounded-xl border border-surface-border bg-white p-8 text-center">
        <p className="text-sm text-slate-700">Individual not found.</p>
        <Button variant="outline" className="mt-3" onClick={() => navigate('/individual')}>
          Back to individuals
        </Button>
      </div>
    );
  }

  const readOnly = !isAdmin;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumbs
          items={[{ label: 'Individuals', to: '/individual' }, { label: individual.full_name }]}
        />
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )}
      </div>

      <IndividualHero individual={individual} />

      <Tabs defaultValue="documents">
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="visas">Visas</TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <DocumentsTab key={individual.id} individual={individual} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="properties">
          <PropertiesTab individual={individual} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="financials">
          <FinancialsTab individual={individual} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="visas">
          <VisasTab key={individual.id} individual={individual} readOnly={readOnly} />
        </TabsContent>
      </Tabs>

      {/* Edit drawer — mirrors the Property Details edit flow. */}
      <SlideOverDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit individual"
        description={individual.full_name}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form={EDIT_INDIVIDUAL_FORM_ID} disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <EditIndividualForm
            key={individual.id}
            individual={individual}
            formId={EDIT_INDIVIDUAL_FORM_ID}
            onSubmit={async (data) => {
              await update.mutateAsync({ id: individual.id, ...data });
              setEditOpen(false);
            }}
          />
          <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
            <h3 className="text-sm font-semibold text-brand-danger">Danger zone</h3>
            <p className="mt-1 text-xs text-slate-700">
              Archiving hides this profile. Linked assets keep their records.
            </p>
            <Button
              variant="outline"
              className="mt-3 border-red-300 text-brand-danger"
              onClick={() => {
                setEditOpen(false);
                setArchiveOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" /> Archive profile
            </Button>
          </div>
        </div>
      </SlideOverDrawer>

      <ConfirmModal
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive profile?"
        description={`"${individual.full_name}" will be hidden. Linked assets keep their records.`}
        confirmLabel="Archive"
        loading={archive.isPending}
        onConfirm={async () => {
          await archive.mutateAsync(individual.id);
          setArchiveOpen(false);
          navigate('/individual');
        }}
      />
    </div>
  );
}
