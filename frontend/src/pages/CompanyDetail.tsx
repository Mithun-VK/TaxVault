import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  Building2,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  Link2,
  Pencil,
  Plus,
  Trash2,
  Unlink,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchInput } from '@/components/shared/SearchInput';
import { SlideOverDrawer } from '@/components/shared/SlideOverDrawer';
import { CompanyDocUploader } from '@/components/companies/CompanyDocUploader';
import { AssetForm } from '@/components/assets/AssetForm';
import {
  useCompany,
  useCompanyAssets,
  useCompanyDocuments,
  useCompanyDocumentUploadUrl,
  useCreateCompany,
  useDeleteCompanyDocument,
  useLinkAssetToCompany,
  useUpdateCompany,
  useArchiveCompany,
  companyKeys,
} from '@/api/companies';
import { useAssets, useCreateAsset } from '@/api/assets';
import { useBills } from '@/api/bills';
import { useIndividuals } from '@/api/individuals';
import { useTaxes } from '@/api/taxes';
import { queryClient } from '@/api/client';
import { useCan } from '@/hooks/usePermissions';
import {
  ACCEPTED_FILE_TYPES,
  ACCOUNT_TYPES,
  BANK_NAME_SUGGESTIONS,
  COMPANY_DOCUMENT_CATEGORIES,
  COMPANY_DOC_GROUP_LABELS,
  COMPANY_KEY_NUMBERS,
  COMPANY_STATUSES,
  COMPANY_TYPES,
  COMPANY_TYPE_COLOR,
  DIRECTOR_DESIGNATIONS,
  EXPORTER_TYPES,
  FINANCIAL_YEAR_ENDS,
  MAX_UPLOAD_SIZE,
  gstStateName,
} from '@/utils/constants';
import {
  buildComplianceRows,
  needsAttention,
  recentFinancialYears,
  STATUS_LABELS,
  STATUS_TONES,
  type ComplianceRow,
} from '@/utils/compliance';
import { formatINR, getInitials } from '@/utils/formatters';
import { formatDate, toInputDate, daysUntil } from '@/utils/dates';
import { uploadToR2, validateFile } from '@/utils/upload';
import { cn } from '@/lib/utils';
import type {
  Asset,
  BankAccount,
  Company,
  CompanyCreate,
  CompanyDocument,
  Director,
  OtherRegistration,
} from '@/types';

const CREATE_COMPANY_FORM_ID = 'company-create-form';
const OVERVIEW_FORM_ID = 'company-overview-form';
const COMPANY_ASSET_FORM_ID = 'company-asset-form';

const typeLabel = (v: string) => COMPANY_TYPES.find((t) => t.value === v)?.label ?? v;
const statusOption = (v: string) => COMPANY_STATUSES.find((s) => s.value === v);
const categoryLabel = (v: string) =>
  COMPANY_DOCUMENT_CATEGORIES.find((c) => c.value === v)?.label ?? v;
const fyEndLabel = (v?: string) =>
  FINANCIAL_YEAR_ENDS.find((f) => f.value === v)?.label ?? v ?? '-';

/** Share capital exists only for bodies corporate. */
const HAS_SHARE_CAPITAL = ['private_limited', 'public_limited', 'one_person'];
const IS_FOREIGN_TYPE = ['foreign_subsidiary', 'branch_office'];

// ── Shared bits ──────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
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
      {hint}
    </div>
  );
}

function Section({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
        {action}
      </div>
      {children}
    </Card>
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
    <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', tone)}>
      {opt?.label ?? status}
    </span>
  );
}

/** Expiry urgency colouring, shared by document cards and the compliance table. */
function expiryTone(days: number): string {
  if (days < 0) return 'bg-red-100 text-red-900';
  if (days <= 30) return 'bg-red-50 text-brand-danger';
  if (days <= 90) return 'bg-amber-50 text-amber-700';
  return 'bg-emerald-50 text-emerald-700';
}

// ── Company form fields ──────────────────────────────────────────────────────

interface CompanyFields {
  legal_name: string;
  trade_name: string;
  company_type: string;
  status: string;
  industry: string;
  description: string;
  registered_address: string;
  operational_address: string;
  phone_number: string;
  email: string;
  website: string;
  incorporation_date: string;
  incorporation_state: string;
  cin: string;
  llpin: string;
  financial_year_end: string;
  pan_number: string;
  tan_number: string;
  gstin: string;
  income_tax_ward: string;
  iec_code: string;
  exporter_type: string;
  aepc_code: string;
  textile_committee_code: string;
  msme_number: string;
  esi_number: string;
  epf_number: string;
  professional_tax_number: string;
  foreign_registration_number: string;
  foreign_jurisdiction: string;
  foreign_registration_date: string;
  foreign_registration_expiry: string;
  authorized_capital: string;
  paid_up_capital: string;
  auditor_name: string;
  auditor_firm_number: string;
  notes: string;
}

function toFields(c?: Company): CompanyFields {
  return {
    legal_name: c?.legal_name ?? '',
    trade_name: c?.trade_name ?? '',
    company_type: c?.company_type ?? 'private_limited',
    status: c?.status ?? 'active',
    industry: c?.industry ?? '',
    description: c?.description ?? '',
    registered_address: c?.registered_address ?? '',
    operational_address: c?.operational_address ?? '',
    phone_number: c?.phone_number ?? '',
    email: c?.email ?? '',
    website: c?.website ?? '',
    incorporation_date: c?.incorporation_date ? toInputDate(c.incorporation_date) : '',
    incorporation_state: c?.incorporation_state ?? '',
    cin: c?.cin ?? '',
    llpin: c?.llpin ?? '',
    financial_year_end: c?.financial_year_end ?? '03-31',
    pan_number: c?.pan_number ?? '',
    tan_number: c?.tan_number ?? '',
    gstin: c?.gstin ?? '',
    income_tax_ward: c?.income_tax_ward ?? '',
    iec_code: c?.iec_code ?? '',
    exporter_type: c?.exporter_type ?? '',
    aepc_code: c?.aepc_code ?? '',
    textile_committee_code: c?.textile_committee_code ?? '',
    msme_number: c?.msme_number ?? '',
    esi_number: c?.esi_number ?? '',
    epf_number: c?.epf_number ?? '',
    professional_tax_number: c?.professional_tax_number ?? '',
    foreign_registration_number: c?.foreign_registration_number ?? '',
    foreign_jurisdiction: c?.foreign_jurisdiction ?? '',
    foreign_registration_date: c?.foreign_registration_date
      ? toInputDate(c.foreign_registration_date)
      : '',
    foreign_registration_expiry: c?.foreign_registration_expiry
      ? toInputDate(c.foreign_registration_expiry)
      : '',
    authorized_capital: c?.authorized_capital != null ? String(c.authorized_capital) : '',
    paid_up_capital: c?.paid_up_capital != null ? String(c.paid_up_capital) : '',
    auditor_name: c?.auditor_name ?? '',
    auditor_firm_number: c?.auditor_firm_number ?? '',
    notes: c?.notes ?? '',
  };
}

/** Blank strings become undefined - the API's identifier validators reject "". */
function cleanPayload(f: CompanyFields): CompanyCreate {
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  const str = (v: string) => v.trim() || undefined;
  const upper = (v: string) => v.trim().toUpperCase() || undefined;
  return {
    legal_name: f.legal_name.trim(),
    trade_name: str(f.trade_name),
    company_type: f.company_type,
    status: f.status,
    industry: str(f.industry),
    description: str(f.description),
    registered_address: str(f.registered_address),
    operational_address: str(f.operational_address),
    phone_number: str(f.phone_number),
    email: str(f.email),
    website: str(f.website),
    incorporation_date: f.incorporation_date || undefined,
    incorporation_state: str(f.incorporation_state),
    cin: upper(f.cin),
    llpin: upper(f.llpin),
    financial_year_end: str(f.financial_year_end),
    pan_number: upper(f.pan_number),
    tan_number: upper(f.tan_number),
    gstin: upper(f.gstin),
    income_tax_ward: str(f.income_tax_ward),
    iec_code: upper(f.iec_code),
    // "" would fail the enum check; undefined means "not an exporter".
    exporter_type: str(f.exporter_type),
    aepc_code: str(f.aepc_code),
    textile_committee_code: str(f.textile_committee_code),
    msme_number: upper(f.msme_number),
    esi_number: str(f.esi_number),
    epf_number: str(f.epf_number),
    professional_tax_number: str(f.professional_tax_number),
    foreign_registration_number: str(f.foreign_registration_number),
    foreign_jurisdiction: str(f.foreign_jurisdiction),
    foreign_registration_date: f.foreign_registration_date || undefined,
    foreign_registration_expiry: f.foreign_registration_expiry || undefined,
    authorized_capital: num(f.authorized_capital),
    paid_up_capital: num(f.paid_up_capital),
    auditor_name: str(f.auditor_name),
    auditor_firm_number: str(f.auditor_firm_number),
    notes: str(f.notes),
  };
}

/**
 * The company's editable fields, grouped exactly as the Overview tab lists
 * them. Used inline on Overview (with a Save Changes button) and on the create
 * page, so both surfaces validate identically.
 */
function CompanyForm({
  company,
  formId,
  onSubmit,
}: {
  company?: Company;
  formId: string;
  onSubmit: (data: CompanyCreate) => Promise<void> | void;
}) {
  const [fields, setFields] = useState<CompanyFields>(() => toFields(company));
  const set = (k: keyof CompanyFields, v: string) => setFields((f) => ({ ...f, [k]: v }));

  const isLlp = fields.company_type === 'llp';
  const showCapital = HAS_SHARE_CAPITAL.includes(fields.company_type);
  const showForeign = IS_FOREIGN_TYPE.includes(fields.company_type);

  // The GSTIN's leading two digits identify the state; surface that as the
  // user types, so a wrong-state GSTIN is obvious before it's saved.
  const stateCode = fields.gstin.trim().slice(0, 2);
  const stateName = gstStateName(stateCode);

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        if (fields.legal_name.trim()) onSubmit(cleanPayload(fields));
      }}
      className="space-y-5"
    >
      <Section title="Basic details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Legal name" required className="sm:col-span-2">
            <Input value={fields.legal_name} onChange={(e) => set('legal_name', e.target.value)} />
          </Field>
          <Field label="Trade / brand name" className="sm:col-span-2">
            <Input
              value={fields.trade_name}
              placeholder="If different from the legal name"
              onChange={(e) => set('trade_name', e.target.value)}
            />
          </Field>
          <Field label="Company type">
            <Select value={fields.company_type} onValueChange={(v) => set('company_type', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_TYPES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={fields.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_STATUSES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Industry">
            <Input
              value={fields.industry}
              placeholder="e.g. Textile Export"
              onChange={(e) => set('industry', e.target.value)}
            />
          </Field>
          <Field label="Phone number">
            <Input
              value={fields.phone_number}
              onChange={(e) => set('phone_number', e.target.value)}
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={fields.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
          <Field label="Website">
            <Input value={fields.website} onChange={(e) => set('website', e.target.value)} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={fields.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>
          <Field label="Registered address" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={fields.registered_address}
              onChange={(e) => set('registered_address', e.target.value)}
            />
          </Field>
          <Field label="Operational address" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={fields.operational_address}
              onChange={(e) => set('operational_address', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Incorporation">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Incorporation date">
            <Input
              type="date"
              value={fields.incorporation_date}
              onChange={(e) => set('incorporation_date', e.target.value)}
            />
          </Field>
          <Field label="State of incorporation">
            <Input
              value={fields.incorporation_state}
              onChange={(e) => set('incorporation_state', e.target.value)}
            />
          </Field>
          <Field label="CIN">
            <Input
              value={fields.cin}
              placeholder="U12345MH2020PTC123456"
              onChange={(e) => set('cin', e.target.value)}
            />
          </Field>
          {isLlp && (
            <Field label="LLPIN">
              <Input
                value={fields.llpin}
                placeholder="AAB-1234"
                onChange={(e) => set('llpin', e.target.value)}
              />
            </Field>
          )}
          <Field label="Financial year end">
            <Select
              value={fields.financial_year_end}
              onValueChange={(v) => set('financial_year_end', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FINANCIAL_YEAR_ENDS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Tax registrations">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="PAN number">
            <Input
              value={fields.pan_number}
              placeholder="AABCC1234D"
              onChange={(e) => set('pan_number', e.target.value)}
            />
          </Field>
          <Field label="TAN number">
            <Input
              value={fields.tan_number}
              placeholder="CHEN12345A"
              onChange={(e) => set('tan_number', e.target.value)}
            />
          </Field>
          <Field
            label="GSTIN"
            hint={
              stateName ? (
                <p className="text-xs font-medium text-brand-navy">
                  {stateCode} → {stateName}
                </p>
              ) : stateCode.length === 2 ? (
                <p className="text-xs text-amber-700">{stateCode} → unknown state code</p>
              ) : undefined
            }
          >
            <Input
              value={fields.gstin}
              placeholder="33AABCC1234D1Z5"
              onChange={(e) => set('gstin', e.target.value)}
            />
          </Field>
          <Field label="Income tax ward / assessing officer">
            <Input
              value={fields.income_tax_ward}
              onChange={(e) => set('income_tax_ward', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Export & trade registrations">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="IE Code"
            hint={
              <p className="text-xs text-slate-600">
                Import Export Code - since 2017 this is the entity's PAN.
              </p>
            }
          >
            <Input
              value={fields.iec_code}
              placeholder="AABCC1234D"
              onChange={(e) => set('iec_code', e.target.value)}
            />
          </Field>
          <Field label="Exporter type">
            <Select
              value={fields.exporter_type || 'none'}
              onValueChange={(v) => set('exporter_type', v === 'none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not an exporter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not an exporter</SelectItem>
                {EXPORTER_TYPES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="AEPC code">
            <Input
              value={fields.aepc_code}
              placeholder="Apparel Export Promotion Council"
              onChange={(e) => set('aepc_code', e.target.value)}
            />
          </Field>
          <Field label="Textile Committee code">
            <Input
              value={fields.textile_committee_code}
              onChange={(e) => set('textile_committee_code', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Statutory registrations">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="MSME / Udyam number"
            hint={
              <p className="text-xs text-slate-600">
                Udyam format UDYAM-TN-01-0012345; legacy UAM numbers accepted as-is.
              </p>
            }
          >
            <Input
              value={fields.msme_number}
              placeholder="UDYAM-TN-01-0012345"
              onChange={(e) => set('msme_number', e.target.value)}
            />
          </Field>
          <Field label="EPF number">
            <Input
              value={fields.epf_number}
              placeholder="Establishment code"
              onChange={(e) => set('epf_number', e.target.value)}
            />
          </Field>
          <Field label="ESI number">
            <Input
              value={fields.esi_number}
              placeholder="17-digit employer code"
              onChange={(e) => set('esi_number', e.target.value)}
            />
          </Field>
          <Field label="Professional tax number">
            <Input
              value={fields.professional_tax_number}
              onChange={(e) => set('professional_tax_number', e.target.value)}
            />
          </Field>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          EPF, ESI and professional tax numbers switch on their monthly rows in the Compliance
          tab - a company with no EPF code is not asked for an EPF return.
        </p>
      </Section>

      {showForeign && (
        <Section title="Foreign entity">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Foreign registration number">
              <Input
                value={fields.foreign_registration_number}
                placeholder="JAFZA license / UAE TRN"
                onChange={(e) => set('foreign_registration_number', e.target.value)}
              />
            </Field>
            <Field label="Jurisdiction">
              <Input
                value={fields.foreign_jurisdiction}
                placeholder="JAFZA, Dubai, UAE"
                onChange={(e) => set('foreign_jurisdiction', e.target.value)}
              />
            </Field>
            <Field label="Registration date">
              <Input
                type="date"
                value={fields.foreign_registration_date}
                onChange={(e) => set('foreign_registration_date', e.target.value)}
              />
            </Field>
            <Field label="Registration expiry">
              <Input
                type="date"
                value={fields.foreign_registration_expiry}
                onChange={(e) => set('foreign_registration_expiry', e.target.value)}
              />
            </Field>
          </div>
        </Section>
      )}

      {showCapital && (
        <Section title="Share capital">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Authorized capital (₹)">
              <Input
                type="number"
                min={0}
                value={fields.authorized_capital}
                onChange={(e) => set('authorized_capital', e.target.value)}
              />
            </Field>
            <Field label="Paid-up capital (₹)">
              <Input
                type="number"
                min={0}
                value={fields.paid_up_capital}
                onChange={(e) => set('paid_up_capital', e.target.value)}
              />
            </Field>
          </div>
        </Section>
      )}

      <Section title="Audit">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Auditor name">
            <Input
              value={fields.auditor_name}
              onChange={(e) => set('auditor_name', e.target.value)}
            />
          </Field>
          <Field label="ICAI firm registration number">
            <Input
              value={fields.auditor_firm_number}
              onChange={(e) => set('auditor_firm_number', e.target.value)}
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={fields.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Field>
        </div>
      </Section>
    </form>
  );
}

// ── Logo ─────────────────────────────────────────────────────────────────────

function CompanyLogo({
  company,
  size = 'lg',
  readOnly,
}: {
  company: Company;
  size?: 'lg' | 'sm';
  readOnly?: boolean;
}) {
  const update = useUpdateCompany();
  const getUrl = useCompanyDocumentUploadUrl();
  const [busy, setBusy] = useState(false);
  const accent = COMPANY_TYPE_COLOR[company.company_type] ?? COMPANY_TYPE_COLOR.other;
  const px = size === 'lg' ? 'h-24 w-24 text-2xl' : 'h-16 w-16 text-xl';

  const upload = async (file: File) => {
    const error = validateFile(file, ACCEPTED_FILE_TYPES, MAX_UPLOAD_SIZE);
    if (error) {
      toast.error(error);
      return;
    }
    setBusy(true);
    try {
      const { upload_url, storage_key } = await getUrl.mutateAsync({
        companyId: company.id,
        category: 'logo',
        fileName: file.name,
        mimeType: file.type,
        fileSizeKb: Math.round(file.size / 1024),
      });
      await uploadToR2(upload_url, file);
      await update.mutateAsync({ id: company.id, logo_key: storage_key });
    } catch {
      toast.error('Logo upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {company.logo_url ? (
        <img
          src={company.logo_url}
          alt={`${company.legal_name} logo`}
          className={cn('shrink-0 rounded-full object-cover', px)}
        />
      ) : (
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full font-medium text-white',
            px,
          )}
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        >
          {getInitials(company.legal_name)}
        </span>
      )}
      {!readOnly && (
        <label className="cursor-pointer text-xs font-medium text-brand-navy hover:underline">
          {busy ? 'Uploading…' : company.logo_url ? 'Replace logo' : '+ Upload Logo'}
          <input
            type="file"
            accept={ACCEPTED_FILE_TYPES.join(',')}
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = '';
            }}
          />
        </label>
      )}
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

/**
 * The registration numbers, front and centre on the company page.
 *
 * These are what someone is actually asked for on a call - GSTIN, IEC, EPF -
 * so they sit in the hero rather than behind the Overview tab. Each is
 * click-to-copy, because the next thing anyone does with a number is paste it.
 */
function KeyNumbers({ company }: { company: Company }) {
  const [copied, setCopied] = useState<string | null>(null);

  // Every number is listed, filled in or not - the blanks show at a glance
  // what is still missing for this company.
  const entries = COMPANY_KEY_NUMBERS.map((spec) => ({
    ...spec,
    value: (company as unknown as Record<string, string | undefined>)[spec.key],
  }));
  const onFile = entries.filter((e) => !!e.value).length;

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <div className="mt-5 border-t border-surface-border pt-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Registration numbers
        </p>
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
          {onFile} of {entries.length} on file
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map((entry) => (
          <div key={entry.key} className="min-w-0">
            <p className="text-xs text-slate-600">{entry.label}</p>
            {entry.value ? (
              <button
                type="button"
                onClick={() => copy(entry.label, entry.value as string)}
                title={`Copy ${entry.label}`}
                className="group flex w-full items-center gap-1.5 text-left"
              >
                <span className="min-w-0 break-all font-mono text-sm font-medium text-slate-800 group-hover:text-brand-navy">
                  {entry.value}
                </span>
                {copied === entry.label ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Copy
                    className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                )}
              </button>
            ) : (
              <p className="mt-0.5 text-sm font-medium text-slate-500">-</p>
            )}
            {entry.key === 'gstin' && gstStateName(company.gstin_state_code) && (
              <p className="text-[11px] text-slate-600">
                {company.gstin_state_code} → {gstStateName(company.gstin_state_code)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanyHero({ company }: { company: Company }) {
  const accent = COMPANY_TYPE_COLOR[company.company_type] ?? COMPANY_TYPE_COLOR.other;
  const exporter = EXPORTER_TYPES.find((e) => e.value === company.exporter_type)?.label;
  const rows = [
    { label: 'Company type', value: typeLabel(company.company_type) },
    { label: 'Industry', value: company.industry ?? '-' },
    {
      label: 'Incorporated',
      value: company.incorporation_date ? formatDate(company.incorporation_date) : '-',
    },
    { label: 'Exporter type', value: exporter ?? '-' },
    { label: 'Phone', value: company.phone_number ?? '-' },
    { label: 'Email', value: company.email ?? '-' },
  ];

  return (
    <Card className="border-l-4 p-6" style={{ borderLeftColor: accent }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <CompanyLogo company={company} size="sm" readOnly />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={company.status} />
              <Badge variant="outline" className="text-slate-700">
                {typeLabel(company.company_type)}
              </Badge>
              {company.expiring_docs_count > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <AlertTriangle className="h-3 w-3" /> {company.expiring_docs_count} expiring
                </span>
              )}
              {company.is_archived && (
                <Badge variant="outline" className="text-slate-600">
                  Archived
                </Badge>
              )}
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {company.legal_name}
            </h2>
            {company.trade_name && company.trade_name !== company.legal_name && (
              <p className="mt-0.5 text-sm text-slate-700">Trading as {company.trade_name}</p>
            )}
          </div>
        </div>
        {company.created_at && (
          <div className="text-right">
            <p className="text-xs text-slate-600">Added</p>
            <p className="mt-0.5 text-sm font-medium text-slate-700">
              {formatDate(company.created_at)}
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

      <KeyNumbers company={company} />

      {company.notes && (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {company.notes}
        </p>
      )}
    </Card>
  );
}

// ── Tab 1: Overview ──────────────────────────────────────────────────────────

function OverviewTab({
  company,
  readOnly,
  canDelete,
  onArchive,
}: {
  company: Company;
  readOnly: boolean;
  canDelete: boolean;
  onArchive: () => void;
}) {
  const update = useUpdateCompany();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Left third - identity card. */}
      <div className="space-y-4 lg:col-span-1">
        <Card className="flex flex-col items-center p-6 text-center">
          <CompanyLogo company={company} readOnly={readOnly} />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">{company.legal_name}</h3>
          {company.trade_name && company.trade_name !== company.legal_name && (
            <p className="mt-0.5 text-sm text-slate-600">{company.trade_name}</p>
          )}
          <div className="mt-3">
            <StatusPill status={company.status} />
          </div>
          <p className="mt-2 text-sm text-slate-700">{typeLabel(company.company_type)}</p>
          {company.industry && <p className="text-sm text-slate-600">{company.industry}</p>}
          {company.website && (
            <a
              href={
                company.website.startsWith('http') ? company.website : `https://${company.website}`
              }
              target="_blank"
              rel="noreferrer"
              className="mt-2 break-all text-sm text-brand-navy hover:underline"
            >
              {company.website}
            </a>
          )}
          <dl className="mt-4 w-full space-y-2 border-t border-surface-border pt-4 text-left">
            <div className="flex justify-between gap-3 text-xs">
              <dt className="text-slate-600">Documents</dt>
              <dd className="font-medium text-slate-800">{company.document_count}</dd>
            </div>
            <div className="flex justify-between gap-3 text-xs">
              <dt className="text-slate-600">Properties</dt>
              <dd className="font-medium text-slate-800">{company.asset_count}</dd>
            </div>
            <div className="flex justify-between gap-3 text-xs">
              <dt className="text-slate-600">Active directors</dt>
              <dd className="font-medium text-slate-800">{company.active_director_count}</dd>
            </div>
            <div className="flex justify-between gap-3 text-xs">
              <dt className="text-slate-600">Financial year end</dt>
              <dd className="font-medium text-slate-800">
                {fyEndLabel(company.financial_year_end)}
              </dd>
            </div>
          </dl>
        </Card>

        <OtherRegistrationsSection company={company} readOnly={readOnly} />

        {canDelete && (
          <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
            <h3 className="text-sm font-semibold text-brand-danger">Danger zone</h3>
            <p className="mt-1 text-xs text-slate-700">
              Archiving hides this company. Linked properties keep their records.
            </p>
            <Button
              variant="outline"
              className="mt-3 border-red-300 text-brand-danger"
              onClick={onArchive}
            >
              <Trash2 className="h-4 w-4" /> Archive company
            </Button>
          </div>
        )}
      </div>

      {/* Right two-thirds - the editable field groups. */}
      <div className="space-y-4 lg:col-span-2">
        <fieldset disabled={readOnly} className="space-y-4">
          <CompanyForm
            key={company.id}
            company={company}
            formId={OVERVIEW_FORM_ID}
            onSubmit={async (data) => {
              await update.mutateAsync({ id: company.id, ...data });
            }}
          />
        </fieldset>
        {!readOnly && (
          <div className="flex justify-end">
            <Button type="submit" form={OVERVIEW_FORM_ID} disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The `other_registrations` JSON array - FSSAI, AEPC, IEC, and the rest. */
function OtherRegistrationsSection({
  company,
  readOnly,
}: {
  company: Company;
  readOnly: boolean;
}) {
  const update = useUpdateCompany();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OtherRegistration>({ name: '', number: '' });

  const save = (next: OtherRegistration[]) =>
    update.mutateAsync({ id: company.id, other_registrations: next });

  const add = async () => {
    if (!draft.name.trim()) return;
    await save([...(company.other_registrations ?? []), draft]);
    setDraft({ name: '', number: '' });
    setOpen(false);
  };

  return (
    <Section
      title="Other registrations"
      action={
        !readOnly && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        )
      }
    >
      {(company.other_registrations ?? []).length === 0 ? (
        <p className="py-1 text-sm text-slate-600">
          None recorded - FSSAI, IEC, AEPC and similar go here.
        </p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {(company.other_registrations ?? []).map((reg, i) => {
            const days = reg.expiry_date ? daysUntil(reg.expiry_date) : null;
            return (
              <li key={`${reg.name}-${i}`} className="flex items-start justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{reg.name}</p>
                  <p className="truncate text-xs text-slate-600">
                    {reg.number || 'Number not recorded'}
                  </p>
                  {reg.expiry_date && days !== null && (
                    <span
                      className={cn(
                        'mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium',
                        expiryTone(days),
                      )}
                    >
                      {days < 0 ? 'Expired ' : 'Expires '}
                      {formatDate(reg.expiry_date)}
                    </span>
                  )}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Remove ${reg.name}`}
                    onClick={() =>
                      save((company.other_registrations ?? []).filter((_, x) => x !== i))
                    }
                    className="shrink-0 rounded-md p-1.5 text-slate-600 hover:bg-red-50 hover:text-brand-danger"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add registration</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Name" required>
              <Input
                value={draft.name}
                placeholder="FSSAI License"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Number">
              <Input
                value={draft.number}
                onChange={(e) => setDraft({ ...draft, number: e.target.value })}
              />
            </Field>
            <Field label="Issuing authority">
              <Input
                value={draft.issuing_authority ?? ''}
                onChange={(e) => setDraft({ ...draft, issuing_authority: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Issue date">
                <Input
                  type="date"
                  value={draft.issue_date ?? ''}
                  onChange={(e) => setDraft({ ...draft, issue_date: e.target.value })}
                />
              </Field>
              <Field label="Expiry date">
                <Input
                  type="date"
                  value={draft.expiry_date ?? ''}
                  onChange={(e) => setDraft({ ...draft, expiry_date: e.target.value })}
                />
              </Field>
            </div>
            <Button
              className="w-full"
              disabled={!draft.name.trim() || update.isPending}
              onClick={add}
            >
              {update.isPending ? 'Saving…' : 'Add registration'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

// ── Tab 2: Documents ─────────────────────────────────────────────────────────

/** The documents each group expects, so gaps are visible rather than implied. */
const EXPECTED_BY_GROUP: Record<string, string[]> = {
  incorporation: ['coi', 'moa', 'aoa'],
  tax: ['pan_card', 'gst_certificate', 'tan_allotment'],
  filings: [
    'annual_return',
    'financial_stmt',
    'directors_report',
    'audit_report',
    'itr',
    'gst_return',
  ],
  licenses: [
    'trade_license',
    'fssai_license',
    'import_export',
    'spice_board',
    'aepc_cert',
    'textiles_cert',
  ],
  foreign: ['jafza_license', 'foreign_reg', 'vat_certificate'],
  banking: ['cancelled_cheque', 'bank_statement'],
  hr: ['epf_certificate', 'esi_certificate', 'pt_certificate'],
  other: ['board_resolution', 'power_of_attorney'],
};

/** Incorporation paperwork differs by legal form. */
function incorporationExpected(companyType: string): string[] {
  if (companyType === 'llp') return ['coi', 'llp_agreement'];
  if (companyType === 'partnership') return ['partnership_deed'];
  if (companyType === 'trust' || companyType === 'section_8') return ['trust_deed', 'coi'];
  if (companyType === 'proprietorship') return ['trade_license'];
  return EXPECTED_BY_GROUP.incorporation;
}

function DocumentCard({
  doc,
  readOnly,
  onDelete,
}: {
  doc: CompanyDocument;
  readOnly: boolean;
  onDelete: (doc: CompanyDocument) => void;
}) {
  const days = doc.expiry_date ? daysUntil(doc.expiry_date) : null;
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            doc.is_expired
              ? 'bg-red-100 text-red-900'
              : doc.is_expiring
                ? 'bg-amber-50 text-amber-700'
                : 'bg-slate-100 text-slate-600',
          )}
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{doc.label}</p>
          <p className="truncate text-xs text-slate-600">
            {categoryLabel(doc.category)}
            {doc.financial_year ? ` · FY ${doc.financial_year}` : ''}
            {doc.issue_date ? ` · Issued ${formatDate(doc.issue_date)}` : ''}
          </p>
          {doc.expiry_date && days !== null && (
            <span
              className={cn(
                'mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium',
                expiryTone(days),
              )}
            >
              {days < 0
                ? `Expired ${formatDate(doc.expiry_date)}`
                : `Expires ${formatDate(doc.expiry_date)} · ${days}d`}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {doc.download_url && (
          <a
            href={doc.download_url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Download ${doc.label}`}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-brand-navy"
          >
            <Download className="h-4 w-4" />
          </a>
        )}
        {!readOnly && (
          <button
            type="button"
            aria-label={`Delete ${doc.label}`}
            onClick={() => onDelete(doc)}
            className="rounded-md p-1.5 text-slate-600 hover:bg-red-50 hover:text-brand-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  );
}

function DocumentsTab({ company, readOnly }: { company: Company; readOnly: boolean }) {
  const { data: documents = [], isLoading } = useCompanyDocuments(company.id);
  const del = useDeleteCompanyDocument();
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyDocument | null>(null);

  const years = useMemo(
    () => recentFinancialYears(company.financial_year_end, 5),
    [company.financial_year_end],
  );
  const [fy, setFy] = useState(() => years[0]);

  const groupOf = useMemo(
    () => new Map(COMPANY_DOCUMENT_CATEGORIES.map((c) => [c.value, c.group ?? 'other'])),
    [],
  );

  const showForeign =
    IS_FOREIGN_TYPE.includes(company.company_type) ||
    !!company.foreign_registration_number ||
    !!company.foreign_jurisdiction;

  const groups = useMemo(() => {
    return Object.entries(COMPANY_DOC_GROUP_LABELS)
      .filter(([key]) => key !== 'foreign' || showForeign)
      .map(([key, label]) => {
        const all = documents.filter((d) => (groupOf.get(d.category) ?? 'other') === key);
        // Annual filings are scoped to the selected financial year; everything
        // else is standing paperwork.
        const docs = key === 'filings' ? all.filter((d) => d.financial_year === fy) : all;
        const expected =
          key === 'incorporation'
            ? incorporationExpected(company.company_type)
            : (EXPECTED_BY_GROUP[key] ?? []);
        const missing = expected.filter((cat) => !docs.some((d) => d.category === cat));
        return { key, label, docs, missing, expected };
      });
  }, [documents, groupOf, fy, showForeign, company.company_type]);

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  const filingGaps = groups.find((g) => g.key === 'filings')?.missing ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-700">
          {documents.length} document{documents.length === 1 ? '' : 's'} on file
        </p>
        {!readOnly && (
          <Button size="sm" onClick={() => setUploadFor('other')}>
            <UploadCloud className="h-4 w-4" /> Upload document
          </Button>
        )}
      </div>

      <Accordion
        type="multiple"
        defaultValue={['incorporation', 'filings', 'licenses']}
        className="space-y-2"
      >
        {groups.map((group) => (
          <AccordionItem
            key={group.key}
            value={group.key}
            className="rounded-xl border border-surface-border bg-white px-4"
          >
            <AccordionTrigger className="hover:no-underline">
              <span className="flex flex-1 items-center justify-between gap-3 pr-3">
                <span className="text-sm font-medium text-slate-800">{group.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                    {group.docs.length} on file
                  </span>
                  {group.missing.length > 0 && (
                    <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                      {group.missing.length} missing
                    </span>
                  )}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {group.key === 'filings' && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Label className="text-xs text-slate-600">Financial year</Label>
                  <Select value={fy} onValueChange={setFy}>
                    <SelectTrigger className="h-8 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={y}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filingGaps.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {filingGaps.length} filing{filingGaps.length === 1 ? '' : 's'} missing for FY{' '}
                      {fy}
                    </span>
                  )}
                </div>
              )}

              {group.docs.length > 0 ? (
                <ul className="divide-y divide-surface-border">
                  {group.docs.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      readOnly={readOnly}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </ul>
              ) : (
                <p className="py-2 text-sm text-slate-600">
                  Nothing uploaded{group.key === 'filings' ? ` for FY ${fy}` : ''} yet.
                </p>
              )}

              {group.missing.length > 0 && (
                <div className="mt-3 border-t border-surface-border pt-3">
                  <p className="mb-2 text-xs text-slate-600">Expected but not on file</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.missing.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        disabled={readOnly}
                        onClick={() => setUploadFor(cat)}
                        className="inline-flex items-center gap-1 rounded-md border border-dashed border-surface-border px-2 py-1 text-[12px] text-slate-600 transition-colors hover:border-brand-navy/50 hover:text-brand-navy disabled:cursor-default disabled:opacity-70"
                      >
                        {!readOnly && <Plus className="h-3 w-3" />}
                        {categoryLabel(cat)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!readOnly && (
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setUploadFor(group.expected[0] ?? 'other')}
                  >
                    <UploadCloud className="h-4 w-4" /> Upload to {group.label}
                  </Button>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <SlideOverDrawer
        open={!!uploadFor}
        onOpenChange={(o) => !o && setUploadFor(null)}
        title="Upload document"
        description={company.legal_name}
      >
        {uploadFor && (
          <CompanyDocUploader
            key={uploadFor}
            companyId={company.id}
            defaultCategory={uploadFor}
            defaultFinancialYear={fy}
            onUploaded={() => setUploadFor(null)}
          />
        )}
      </SlideOverDrawer>

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete document?"
        description={`"${deleteTarget?.label}" will be removed from this company.`}
        confirmLabel="Delete"
        loading={del.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await del.mutateAsync({ companyId: company.id, docId: deleteTarget.id });
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

// ── Tab 3: Directors ─────────────────────────────────────────────────────────

const emptyDirector: Director = { name: '', designation: 'Director', is_active: true };

function DirectorsTab({ company, readOnly }: { company: Company; readOnly: boolean }) {
  const navigate = useNavigate();
  const update = useUpdateCompany();
  const { data: individualsData } = useIndividuals();
  const [draft, setDraft] = useState<Director>(emptyDirector);

  const directors = company.directors ?? [];
  const individuals = individualsData?.items ?? [];
  const selected = individuals.find((i) => i.id === draft.individual_id);

  // Allocated shareholding across everyone on record, plus whatever is being
  // typed - a stake that pushes the company over 100% should be obvious.
  const shareTotal = useMemo(() => {
    const existing = directors.reduce((sum, d) => sum + (d.share_percentage ?? 0), 0);
    return Math.round((existing + (draft.share_percentage ?? 0)) * 100) / 100;
  }, [directors, draft.share_percentage]);
  const allocated = useMemo(
    () =>
      Math.round(directors.reduce((sum, d) => sum + (d.share_percentage ?? 0), 0) * 100) / 100,
    [directors],
  );

  const save = (next: Director[]) => update.mutateAsync({ id: company.id, directors: next });

  const add = async () => {
    if (!draft.name.trim()) return;
    await save([...directors, draft]);
    setDraft(emptyDirector);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-slate-700">
          {company.active_director_count} active of {directors.length} on record
        </p>
        {allocated > 0 && (
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-xs font-medium',
              allocated > 100
                ? 'bg-red-50 text-brand-danger'
                : allocated === 100
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-600',
            )}
          >
            {allocated}% shareholding allocated
            {allocated < 100 ? ` · ${Math.round((100 - allocated) * 100) / 100}% unallocated` : ''}
          </span>
        )}
      </div>

      {directors.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No directors recorded"
          description="Add directors, partners or trustees below - link them to an Individual profile where one exists."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {directors.map((d, i) => {
            const linked = individuals.find((ind) => ind.id === d.individual_id);
            return (
              <Card key={`${d.name}-${i}`} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-navy text-sm font-medium text-white">
                      {getInitials(d.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{d.name}</p>
                      <Badge variant="outline" className="mt-0.5 text-slate-700">
                        {d.designation}
                      </Badge>
                      {d.din && <p className="mt-1 text-xs text-slate-600">DIN {d.din}</p>}
                      {d.dsc_number && (
                        <p className="text-xs text-slate-600">
                          DSC {d.dsc_number}
                          {d.dsc_expiry && (
                            <span
                              className={cn(
                                'ml-1 rounded px-1 py-0.5 text-[10px] font-medium',
                                expiryTone(daysUntil(d.dsc_expiry)),
                              )}
                            >
                              {daysUntil(d.dsc_expiry) < 0 ? 'expired' : 'exp'}{' '}
                              {formatDate(d.dsc_expiry)}
                            </span>
                          )}
                        </p>
                      )}
                      {d.appointed_date && (
                        <p className="text-xs text-slate-600">
                          Appointed {formatDate(d.appointed_date)}
                        </p>
                      )}
                      {linked && (
                        <button
                          type="button"
                          onClick={() => navigate(`/individual/${linked.id}`)}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-brand-navy hover:underline"
                        >
                          <Link2 className="h-3 w-3" /> {linked.full_name}
                        </button>
                      )}
                    </div>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      aria-label={`Remove ${d.name}`}
                      onClick={() => save(directors.filter((_, x) => x !== i))}
                      className="shrink-0 rounded-md p-1.5 text-slate-600 hover:bg-red-50 hover:text-brand-danger"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-3">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[12px] font-medium',
                        d.is_active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {d.share_percentage != null && (
                      <span className="rounded-md bg-brand-navy-muted px-1.5 py-0.5 text-[12px] font-medium text-brand-navy">
                        {d.share_percentage}% share
                      </span>
                    )}
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() =>
                        save(
                          directors.map((x, xi) =>
                            xi === i ? { ...x, is_active: !x.is_active } : x,
                          ),
                        )
                      }
                      className="text-xs font-medium text-brand-navy hover:underline"
                    >
                      Mark {d.is_active ? 'inactive' : 'active'}
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!readOnly && (
        <Section title="Add director">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Designation">
              <Select
                value={draft.designation}
                onValueChange={(v) => setDraft({ ...draft, designation: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTOR_DESIGNATIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="DIN">
              <Input
                value={draft.din ?? ''}
                placeholder="8 digits"
                onChange={(e) => setDraft({ ...draft, din: e.target.value })}
              />
            </Field>
            <Field label="Appointed date">
              <Input
                type="date"
                value={draft.appointed_date ?? ''}
                onChange={(e) => setDraft({ ...draft, appointed_date: e.target.value })}
              />
            </Field>
            <Field label="DSC number">
              <Input
                value={draft.dsc_number ?? ''}
                placeholder="Digital Signature Certificate"
                onChange={(e) => setDraft({ ...draft, dsc_number: e.target.value })}
              />
            </Field>
            <Field label="DSC expiry">
              <Input
                type="date"
                value={draft.dsc_expiry ?? ''}
                onChange={(e) => setDraft({ ...draft, dsc_expiry: e.target.value })}
              />
            </Field>
            <Field
              label="Share %"
              hint={
                shareTotal > 100 ? (
                  <p className="text-xs font-medium text-brand-danger">
                    Shareholding totals {shareTotal}% - over 100%
                  </p>
                ) : undefined
              }
            >
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={draft.share_percentage ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    share_percentage: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </Field>
            {individuals.length > 0 && (
              <Field
                label="Link to individual"
                className="sm:col-span-2"
                hint={
                  selected ? (
                    // Confirm the right person before the link is saved.
                    <p className="text-xs text-slate-600">
                      {selected.relationship_to_owner ?? 'Family member'}
                      {selected.phone_number ? ` · ${selected.phone_number}` : ''}
                    </p>
                  ) : undefined
                }
              >
                <Select
                  value={draft.individual_id ?? 'none'}
                  onValueChange={(v) =>
                    setDraft({
                      ...draft,
                      individual_id: v === 'none' ? undefined : v,
                      name:
                        v === 'none'
                          ? draft.name
                          : (individuals.find((i) => i.id === v)?.full_name ?? draft.name),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Not linked" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not linked</SelectItem>
                    {individuals.map((ind) => (
                      <SelectItem key={ind.id} value={ind.id}>
                        {ind.full_name}
                        {ind.relationship_to_owner ? ` · ${ind.relationship_to_owner}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <div className="sm:col-span-2 flex justify-end">
              <Button disabled={!draft.name.trim() || update.isPending} onClick={add}>
                <Plus className="h-4 w-4" />
                {update.isPending ? 'Saving…' : 'Add director'}
              </Button>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Tab 4: Properties ────────────────────────────────────────────────────────

function PropertiesTab({ company, readOnly }: { company: Company; readOnly: boolean }) {
  const navigate = useNavigate();
  const { data, isLoading } = useCompanyAssets(company.id);
  const link = useLinkAssetToCompany();
  const createAsset = useCreateAsset();
  const canCreateProperty = useCan('properties.create');
  const [linkOpen, setLinkOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const assets = data?.items ?? [];

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-700">
          {assets.length} propert{assets.length === 1 ? 'y' : 'ies'} linked to{' '}
          {company.trade_name || company.legal_name}
        </p>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
              <Link2 className="h-4 w-4" /> Link Existing Property
            </Button>
            {canCreateProperty && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add New Property
              </Button>
            )}
          </div>
        )}
      </div>

      {assets.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties linked"
          description="Link an existing property, or add a new one held by this company."
          action={
            !readOnly ? (
              <Button onClick={() => setLinkOpen(true)}>
                <Link2 className="h-4 w-4" /> Link Existing Property
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => (
            <Card key={a.id} className="flex items-start justify-between gap-2 p-4">
              <button
                type="button"
                onClick={() => navigate(`/assets/${a.id}`)}
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy-muted text-brand-navy">
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{a.name}</p>
                  <p className="text-xs capitalize text-slate-600">
                    {a.asset_type.replace(/_/g, ' ')}
                  </p>
                  {Number(a.current_value) > 0 && (
                    <p className="mt-0.5 font-mono text-xs text-slate-600">
                      {formatINR(Number(a.current_value))}
                    </p>
                  )}
                </div>
              </button>
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Unlink ${a.name}`}
                  title="Unlink from this company"
                  disabled={link.isPending}
                  onClick={() => link.mutate({ assetId: a.id, companyId: null })}
                  className="shrink-0 rounded-md p-1.5 text-slate-600 hover:bg-red-50 hover:text-brand-danger disabled:opacity-50"
                >
                  <Unlink className="h-4 w-4" />
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      <LinkPropertyDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        company={company}
        linkedIds={new Set(assets.map((a) => a.id))}
      />

      {/* Create a property already attached to this company. */}
      <SlideOverDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add property"
        description={`Register a new property for ${company.legal_name}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form={COMPANY_ASSET_FORM_ID} disabled={createAsset.isPending}>
              {createAsset.isPending ? 'Saving…' : 'Create property'}
            </Button>
          </>
        }
      >
        <AssetForm
          formId={COMPANY_ASSET_FORM_ID}
          onSubmit={async (payload) => {
            await createAsset.mutateAsync({ ...payload, company_id: company.id });
            queryClient.invalidateQueries({ queryKey: companyKeys.assets(company.id) });
            queryClient.invalidateQueries({ queryKey: companyKeys.lists() });
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
  company,
  linkedIds,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  company: Company;
  linkedIds: Set<string>;
}) {
  const { data: allAssets = [] } = useAssets();
  const link = useLinkAssetToCompany();
  const [search, setSearch] = useState('');

  const candidates = (allAssets as Asset[]).filter(
    (a) =>
      !linkedIds.has(a.id) &&
      a.status !== 'archived' &&
      a.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link a property to {company.legal_name}</DialogTitle>
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
                onClick={() => link.mutate({ assetId: a.id, companyId: company.id })}
                disabled={link.isPending}
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

// ── Tab 5: Compliance ────────────────────────────────────────────────────────

function ComplianceTab({ company, readOnly }: { company: Company; readOnly: boolean }) {
  const { data: documents = [], isLoading } = useCompanyDocuments(company.id);
  const { data: taxes = [] } = useTaxes();
  const { data: bills = [] } = useBills();
  const [uploadFor, setUploadFor] = useState<ComplianceRow | null>(null);

  const rows = useMemo(
    () => buildComplianceRows({ company, documents, taxes, bills }),
    [company, documents, taxes, bills],
  );
  const attention = useMemo(() => needsAttention(rows), [rows]);

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="space-y-4">
      {/* Upcoming strip - what needs doing, as quick chips. */}
      <Card
        className={cn(
          'p-4',
          attention.length > 0 ? 'border-amber-200 bg-amber-50/40' : 'bg-white',
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-800">
            {attention.length === 0
              ? 'Nothing needs attention right now'
              : `${attention.length} item${attention.length === 1 ? '' : 's'} need attention`}
          </p>
          {attention.slice(0, 6).map((row) => (
            <span
              key={row.id}
              className={cn(
                'rounded-md px-2 py-0.5 text-xs font-medium',
                STATUS_TONES[row.status],
              )}
            >
              {row.label} - {formatDate(row.dueDate)}
            </span>
          ))}
        </div>
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left">
                {['Filing', 'Frequency', 'Due Date', 'Status', 'Action'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-600">
                    Nothing to track yet - add a GSTIN or TAN, or upload a license with an expiry
                    date.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-surface-border last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-800">{row.label}</span>
                      {row.financialYear && (
                        <span className="ml-1.5 text-xs text-slate-600">
                          FY {row.financialYear}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{row.frequency}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-700">
                      {formatDate(row.dueDate)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs font-medium',
                          STATUS_TONES[row.status],
                        )}
                      >
                        {STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {row.status === 'done' || readOnly ? (
                        <span className="text-xs text-slate-600">-</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setUploadFor(row)}
                          className="text-xs font-medium text-brand-navy hover:underline"
                        >
                          {row.kind === 'license' ? 'Upload Doc' : 'Mark Done'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-slate-600">
        A filing counts as done once a document of that type is on file for the year - uploading
        the proof is what marks it complete. Monthly rows show the next occurrence.
      </p>

      <SlideOverDrawer
        open={!!uploadFor}
        onOpenChange={(o) => !o && setUploadFor(null)}
        title={uploadFor?.kind === 'license' ? 'Upload renewal' : 'Upload filing'}
        description={uploadFor?.label}
      >
        {uploadFor && (
          <CompanyDocUploader
            key={uploadFor.id}
            companyId={company.id}
            defaultCategory={uploadFor.category ?? 'other'}
            defaultFinancialYear={uploadFor.financialYear}
            defaultLabel={uploadFor.label}
            onUploaded={() => setUploadFor(null)}
          />
        )}
      </SlideOverDrawer>
    </div>
  );
}

// ── Tab 6: Banking ───────────────────────────────────────────────────────────

const emptyAccount: BankAccount = {
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  account_type: 'current',
  is_primary: false,
};

const maskAccount = (n: string) =>
  n.length <= 4 ? n : `${'X'.repeat(Math.max(0, n.length - 4))}${n.slice(-4)}`;

function BankAccountCard({
  account,
  index,
  readOnly,
  chequeUrl,
  onEdit,
  onDelete,
  onMakePrimary,
}: {
  account: BankAccount;
  index: number;
  readOnly: boolean;
  chequeUrl?: string;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onMakePrimary: (index: number) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy-muted text-brand-navy">
            <Banknote className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-sm font-semibold text-slate-900">{account.bank_name}</p>
              {account.is_primary && (
                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                  Primary
                </span>
              )}
            </div>
            {account.branch && <p className="truncate text-xs text-slate-600">{account.branch}</p>}
            <div className="mt-1 flex items-center gap-1.5">
              <p className="font-mono text-xs text-slate-700">
                {revealed ? account.account_number : maskAccount(account.account_number)}
              </p>
              <button
                type="button"
                onClick={() => setRevealed((r) => !r)}
                aria-label={revealed ? 'Hide account number' : 'Show account number'}
                className="rounded p-0.5 text-slate-600 hover:text-brand-navy"
              >
                {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="font-mono text-xs text-slate-600">{account.ifsc_code}</p>
            {chequeUrl && (
              <a
                href={chequeUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-brand-navy hover:underline"
              >
                <FileText className="h-3 w-3" /> Cancelled cheque
              </a>
            )}
          </div>
        </div>
        {!readOnly && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label={`Edit ${account.bank_name} account`}
              onClick={() => onEdit(index)}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-brand-navy"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={`Delete ${account.bank_name} account`}
              onClick={() => onDelete(index)}
              className="rounded-md p-1.5 text-slate-600 hover:bg-red-50 hover:text-brand-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-3">
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] font-medium text-slate-600">
          {ACCOUNT_TYPES.find((t) => t.value === account.account_type)?.label ??
            account.account_type}
        </span>
        {!account.is_primary && !readOnly && (
          <button
            type="button"
            onClick={() => onMakePrimary(index)}
            className="text-xs font-medium text-brand-navy hover:underline"
          >
            Set as Primary
          </button>
        )}
      </div>
    </Card>
  );
}

function BankingTab({ company, readOnly }: { company: Company; readOnly: boolean }) {
  const update = useUpdateCompany();
  const { data: documents = [] } = useCompanyDocuments(company.id);
  const [draft, setDraft] = useState<BankAccount>(emptyAccount);
  const [confirmNumber, setConfirmNumber] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const accounts = company.bank_accounts ?? [];
  // Primary first, so the account that matters leads the grid.
  const ordered = useMemo(
    () =>
      accounts
        .map((account, index) => ({ account, index }))
        .sort((a, b) => Number(b.account.is_primary) - Number(a.account.is_primary)),
    [accounts],
  );
  const chequeUrl = documents.find((d) => d.category === 'cancelled_cheque')?.download_url;

  const save = (next: BankAccount[]) =>
    update.mutateAsync({ id: company.id, bank_accounts: next });

  const reset = () => {
    setDraft(emptyAccount);
    setConfirmNumber('');
    setEditingIndex(null);
  };

  const numbersMatch = draft.account_number.trim() === confirmNumber.trim();
  const complete =
    !!draft.bank_name.trim() && !!draft.account_number.trim() && !!draft.ifsc_code.trim();

  const submit = async () => {
    if (!complete || !numbersMatch) return;
    // Only one primary account: a new primary demotes the rest.
    const demote = (list: BankAccount[]) =>
      draft.is_primary ? list.map((a) => ({ ...a, is_primary: false })) : list;

    const next =
      editingIndex === null
        ? [...demote(accounts), draft]
        : demote(accounts).map((a, i) => (i === editingIndex ? draft : a));
    await save(next);
    reset();
  };

  const startEdit = (index: number) => {
    setDraft(accounts[index]);
    setConfirmNumber(accounts[index].account_number);
    setEditingIndex(index);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700">
        {accounts.length} account{accounts.length === 1 ? '' : 's'} on record
      </p>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="No bank accounts recorded"
          description="Add the company's current, CC and OD accounts for quick reference."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map(({ account, index }) => (
            <BankAccountCard
              key={`${account.account_number}-${index}`}
              account={account}
              index={index}
              readOnly={readOnly}
              chequeUrl={chequeUrl}
              onEdit={startEdit}
              onDelete={setDeleteIndex}
              onMakePrimary={(i) =>
                save(accounts.map((a, x) => ({ ...a, is_primary: x === i })))
              }
            />
          ))}
        </div>
      )}

      {!readOnly && (
        <Section
          title={editingIndex === null ? 'Add bank account' : 'Edit bank account'}
          action={
            editingIndex !== null && (
              <Button variant="outline" size="sm" onClick={reset}>
                Cancel
              </Button>
            )
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Bank name" required>
              <Input
                list="bank-name-suggestions"
                value={draft.bank_name}
                onChange={(e) => setDraft({ ...draft, bank_name: e.target.value })}
              />
              <datalist id="bank-name-suggestions">
                {BANK_NAME_SUGGESTIONS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </Field>
            <Field label="Branch name">
              <Input
                value={draft.branch ?? ''}
                onChange={(e) => setDraft({ ...draft, branch: e.target.value })}
              />
            </Field>
            <Field label="Account number" required>
              <Input
                value={draft.account_number}
                inputMode="numeric"
                onChange={(e) => setDraft({ ...draft, account_number: e.target.value })}
              />
            </Field>
            <Field
              label="Confirm account number"
              required
              hint={
                confirmNumber && !numbersMatch ? (
                  <p className="text-xs font-medium text-brand-danger">
                    Account numbers do not match
                  </p>
                ) : undefined
              }
            >
              <Input
                value={confirmNumber}
                inputMode="numeric"
                onChange={(e) => setConfirmNumber(e.target.value)}
              />
            </Field>
            <Field
              label="IFSC code"
              required
              hint={
                <p className="text-xs text-slate-600">
                  Format ABCD0123456 - the 5th character is always zero.
                </p>
              }
            >
              <Input
                value={draft.ifsc_code}
                placeholder="ABCD0123456"
                onChange={(e) =>
                  setDraft({ ...draft, ifsc_code: e.target.value.toUpperCase() })
                }
              />
            </Field>
            <Field label="Account type">
              <Select
                value={draft.account_type}
                onValueChange={(v) => setDraft({ ...draft, account_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.is_primary}
                onChange={(e) => setDraft({ ...draft, is_primary: e.target.checked })}
                className="h-4 w-4 rounded border-surface-border"
              />
              Set as primary account
            </label>
            <div className="flex justify-end sm:col-span-2">
              <Button disabled={!complete || !numbersMatch || update.isPending} onClick={submit}>
                {update.isPending
                  ? 'Saving…'
                  : editingIndex === null
                    ? 'Add account'
                    : 'Save account'}
              </Button>
            </div>
          </div>
        </Section>
      )}

      <ConfirmModal
        open={deleteIndex !== null}
        onOpenChange={(o) => !o && setDeleteIndex(null)}
        title="Delete bank account?"
        description={
          deleteIndex !== null
            ? `${accounts[deleteIndex]?.bank_name} - ${maskAccount(
                accounts[deleteIndex]?.account_number ?? '',
              )} will be removed.`
            : ''
        }
        confirmLabel="Delete"
        loading={update.isPending}
        onConfirm={async () => {
          if (deleteIndex === null) return;
          await save(accounts.filter((_, i) => i !== deleteIndex));
          setDeleteIndex(null);
        }}
      />
    </div>
  );
}

// ── Create page ──────────────────────────────────────────────────────────────

function CreateCompany() {
  const navigate = useNavigate();
  const create = useCreateCompany();

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Companies', to: '/company' }, { label: 'New company' }]} />
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Add a company</h2>
        <p className="mt-0.5 text-sm text-slate-700">
          Registrations and filings can be filled in later - only the legal name is required.
        </p>
      </div>
      <CompanyForm
        formId={CREATE_COMPANY_FORM_ID}
        onSubmit={async (data) => {
          const company = await create.mutateAsync(data);
          navigate(`/company/${company.id}`);
        }}
      />
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/company')}>
          Cancel
        </Button>
        <Button type="submit" form={CREATE_COMPANY_FORM_ID} disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Create company'}
        </Button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canEdit = useCan('company.edit');
  const canDelete = useCan('company.delete');
  const isNew = !id || id === 'new';

  const { data: company, isLoading } = useCompany(isNew ? undefined : id);
  const archive = useArchiveCompany();
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (isNew) return <CreateCompany />;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="rounded-xl border border-surface-border bg-white p-8 text-center">
        <p className="text-sm text-slate-700">Company not found.</p>
        <Button variant="outline" className="mt-3" onClick={() => navigate('/company')}>
          Back to companies
        </Button>
      </div>
    );
  }

  const readOnly = !canEdit;

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[{ label: 'Companies', to: '/company' }, { label: company.legal_name }]}
      />

      <CompanyHero company={company} />

      <Tabs defaultValue="overview">
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="directors">Directors</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="banking">Banking</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            company={company}
            readOnly={readOnly}
            canDelete={canDelete}
            onArchive={() => setArchiveOpen(true)}
          />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab company={company} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="directors">
          <DirectorsTab company={company} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="properties">
          <PropertiesTab company={company} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="compliance">
          <ComplianceTab company={company} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="banking">
          <BankingTab company={company} readOnly={readOnly} />
        </TabsContent>
      </Tabs>

      <ConfirmModal
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive company?"
        description={`"${company.legal_name}" will be hidden. Linked properties keep their records.`}
        confirmLabel="Archive"
        loading={archive.isPending}
        onConfirm={async () => {
          await archive.mutateAsync(company.id);
          setArchiveOpen(false);
          navigate('/company');
        }}
      />
    </div>
  );
}
