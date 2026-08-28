import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAddCompanyDocument, useCompanyDocumentUploadUrl } from '@/api/companies';
import { uploadToR2, validateFile } from '@/utils/upload';
import { addCustomCategory, loadCustomCategories } from '@/utils/customCategories';
import {
  ACCEPTED_FILE_TYPES,
  COMPANY_DOCUMENT_CATEGORIES,
  COMPANY_DOC_GROUP_LABELS,
  COMPANY_FILING_CATEGORIES,
  MAX_UPLOAD_SIZE,
} from '@/utils/constants';

/** Financial-year options, newest first - filings are almost always recent. */
function financialYears(count = 8): string[] {
  const now = new Date();
  // The FY starting in April of the current calendar year hasn't closed yet,
  // but people do file mid-year, so it stays on the list.
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: count }, (_, i) => {
    const y = startYear - i;
    return `${y}-${String(y + 1).slice(-2)}`;
  });
}

const isFiling = (category: string) =>
  (COMPANY_FILING_CATEGORIES as readonly string[]).includes(category);

/** Sentinel for "a type that isn't on the built-in list". */
const CUSTOM_PREFIX = 'custom:';
const isBuiltIn = (value: string) =>
  COMPANY_DOCUMENT_CATEGORIES.some((c) => c.value === value);

interface CompanyDocUploaderProps {
  companyId: string;
  /** Pre-selects the category - used by the per-section upload buttons. */
  defaultCategory?: string;
  /** Pre-selects the financial year, e.g. from the Compliance row being filed. */
  defaultFinancialYear?: string;
  /** Pre-fills the label, e.g. the compliance row's name. */
  defaultLabel?: string;
  onUploaded?: () => void;
}

/**
 * Upload a company document: pick the file, presign a PUT, push it to R2, then
 * record the row. Mirrors IdentityDocUploader's flow, but a company document
 * carries its own metadata (category, financial year, expiry), so those are
 * collected here rather than written back onto the parent record.
 */
export function CompanyDocUploader({
  companyId,
  defaultCategory = 'other',
  defaultFinancialYear,
  defaultLabel,
  onUploaded,
}: CompanyDocUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(defaultCategory);
  const [label, setLabel] = useState(defaultLabel ?? '');
  const [financialYear, setFinancialYear] = useState(defaultFinancialYear ?? '');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Document types the user has added before, kept per browser the same way
  // custom tax and insurance categories are.
  const [customTypes, setCustomTypes] = useState(() =>
    loadCustomCategories('company_document'),
  );
  const [typeName, setTypeName] = useState('');

  const getUrl = useCompanyDocumentUploadUrl();
  const addDoc = useAddCompanyDocument();

  // "Other Document" and any saved custom type both need a name, since the API
  // stores them all under the `other` category and tells them apart by label.
  const needsTypeName = category === 'other' || category.startsWith(CUSTOM_PREFIX);

  const categoryLabel = needsTypeName
    ? typeName.trim() || 'Other Document'
    : (COMPANY_DOCUMENT_CATEGORIES.find((c) => c.value === category)?.label ?? 'Document');

  const chooseCategory = (value: string) => {
    setCategory(value);
    // Picking a saved type fills its name in; picking a built-in clears it.
    if (value.startsWith(CUSTOM_PREFIX)) {
      const found = customTypes.find((c) => `${CUSTOM_PREFIX}${c.value}` === value);
      setTypeName(found?.label ?? '');
    } else if (value !== 'other') {
      setTypeName('');
    }
  };

  const reset = () => {
    setFile(null);
    setLabel('');
    setFinancialYear('');
    setIssueDate('');
    setExpiryDate('');
    setNotes('');
    setTypeName('');
    setProgress(0);
  };

  const pick = (f: File) => {
    const error = validateFile(f, ACCEPTED_FILE_TYPES, MAX_UPLOAD_SIZE);
    if (error) {
      toast.error(error);
      return;
    }
    setFile(f);
    if (!label) setLabel(categoryLabel);
  };

  // A self-named type is useless without the name, so block upload until given.
  const canSubmit = !!file && (!needsTypeName || !!typeName.trim());

  const submit = async () => {
    if (!file || !canSubmit) return;
    setUploading(true);
    setProgress(0);
    // The API validates `category` against a fixed enum, so anything the user
    // named themselves is filed as "other" and identified by its label.
    const apiCategory = isBuiltIn(category) ? category : 'other';
    try {
      const { upload_url, storage_key } = await getUrl.mutateAsync({
        companyId,
        category: apiCategory,
        fileName: file.name,
        mimeType: file.type,
        fileSizeKb: Math.round(file.size / 1024),
      });
      await uploadToR2(upload_url, file, setProgress);
      await addDoc.mutateAsync({
        companyId,
        category: apiCategory,
        label: label.trim() || categoryLabel,
        financial_year:
          isFiling(apiCategory) && financialYear ? financialYear : undefined,
        storage_key,
        file_name: file.name,
        file_size_kb: Math.round(file.size / 1024),
        mime_type: file.type,
        issue_date: issueDate || undefined,
        expiry_date: expiryDate || undefined,
        notes: notes.trim() || undefined,
      });
      // Remember a newly-typed name so it is one click away next time.
      if (needsTypeName && typeName.trim()) {
        setCustomTypes(
          addCustomCategory(
            'company_document',
            typeName,
            COMPANY_DOCUMENT_CATEGORIES.map((c) => c.value),
          ),
        );
      }
      reset();
      onUploaded?.();
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };


  // Categories are grouped in the dropdown the same way the Documents tab
  // stacks its sections, so the two read as one taxonomy.
  const grouped = Object.entries(COMPANY_DOC_GROUP_LABELS)
    .map(([key, groupLabel]) => ({
      groupLabel,
      options: COMPANY_DOCUMENT_CATEGORIES.filter((c) => c.group === key),
    }))
    .filter((g) => g.options.length > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Document type</Label>
          <Select value={category} onValueChange={chooseCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {grouped.map((g) => (
                <div key={g.groupLabel}>
                  <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {g.groupLabel}
                  </p>
                  {g.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </div>
              ))}
              {customTypes.length > 0 && (
                <div>
                  <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Your document types
                  </p>
                  {customTypes.map((c) => (
                    <SelectItem key={c.value} value={`${CUSTOM_PREFIX}${c.value}`}>
                      {c.label}
                    </SelectItem>
                  ))}
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        {needsTypeName && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              Document type name
              <span className="text-brand-danger"> *</span>
            </Label>
            <Input
              value={typeName}
              placeholder="e.g. Rental Agreement, Factory License"
              onChange={(e) => setTypeName(e.target.value)}
            />
            <p className="text-xs text-slate-600">
              Name this kind of document and it is saved to your list, ready to pick next time.
            </p>
          </div>
        )}

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Label</Label>
          <Input
            value={label}
            placeholder={categoryLabel}
            onChange={(e) => setLabel(e.target.value)}
          />
          <p className="text-xs text-slate-600">
            What this specific file is called. Defaults to the document type.
          </p>
        </div>

        {isFiling(category) && (
          <div className="space-y-1.5">
            <Label>Financial year</Label>
            <Select value={financialYear} onValueChange={setFinancialYear}>
              <SelectTrigger>
                <SelectValue placeholder="Select FY" />
              </SelectTrigger>
              <SelectContent>
                {financialYears().map((fy) => (
                  <SelectItem key={fy} value={fy}>
                    {fy}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Issue date</Label>
          <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Expiry date</Label>
          <Input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
          <p className="text-xs text-slate-600">
            Set this for renewable licenses - it drives the expiry warnings.
          </p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea
            rows={2}
            value={notes}
            placeholder="Anything worth remembering about this document"
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-white p-3">
          <p className="min-w-0 truncate text-sm text-slate-800">{file.name}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setFile(null)}>
            Remove
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-surface-border bg-slate-50/50 px-6 py-6 text-center transition-colors hover:border-brand-navy/50 disabled:opacity-60"
        >
          <UploadCloud className="h-6 w-6 text-slate-600" aria-hidden="true" />
          <p className="mt-1.5 text-sm font-medium text-slate-700">Choose a file</p>
          <p className="mt-0.5 text-xs text-slate-600">JPG, PNG or PDF up to 10 MB</p>
        </button>
      )}

      {uploading && (
        <div className="space-y-1">
          <Progress value={progress} />
          <p className="text-right text-xs text-slate-600 tabular-nums">{progress}%</p>
        </div>
      )}

      <Button
        type="button"
        className="w-full"
        disabled={!canSubmit || uploading}
        onClick={submit}
      >
        {uploading ? 'Uploading…' : 'Upload document'}
      </Button>
      {needsTypeName && !typeName.trim() && (
        <p className="text-center text-xs text-slate-600">
          Give the document type a name to continue.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
