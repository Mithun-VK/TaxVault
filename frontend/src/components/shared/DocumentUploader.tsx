import { useCallback, useEffect, useRef, useState } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useRequestUploadUrl, useCreateDocument } from '@/api/documents';
import { uploadToR2, validateFile } from '@/utils/upload';
import { ACCEPTED_FILE_TYPES, MAX_UPLOAD_SIZE, DOCUMENT_CATEGORIES } from '@/utils/constants';
import { getCurrentFY, getFYOptions, toInputDate } from '@/utils/dates';
import { dateTag, halfTag, HALF_LABEL, type DocDateInput } from '@/utils/propertyDocs';
import { formatFileSize } from '@/utils/formatters';
import type { DocumentCategory, PaymentEntityType, TaxDocument } from '@/types';

/** Suggest a category from the file name so the user rarely has to pick. */
function detectCategory(fileName: string): DocumentCategory | null {
  const n = fileName.toLowerCase();
  if (n.includes('patta')) return 'patta';
  if (n.includes('deed')) return 'deed';
  if (n.includes('encumbrance') || n.includes(' ec ') || n.includes('_ec')) return 'encumbrance';
  if (n.includes('premium')) return 'premium_receipt';
  if (n.includes('policy')) return 'policy_doc';
  if (n.includes('itr')) return 'itr';
  if (n.includes('receipt') || n.includes('paid')) return 'tax_receipt';
  return null;
}

/** "tax_receipt_2026.pdf" -> "Tax Receipt 2026". */
function labelFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface DocumentUploaderProps {
  entityType?: PaymentEntityType;
  entityId?: string;
  defaultCategory?: DocumentCategory;
  defaultLabel?: string;
  defaultTags?: string[];
  compact?: boolean;
  /**
   * Upload the moment a file is chosen (no separate "Upload document" click).
   * Used for payment receipts so a picked-but-not-uploaded file can't be lost
   * when the surrounding form is submitted.
   */
  autoUpload?: boolean;
  /**
   * When uploading into a property-document slot: `date` asks for the document
   * date; `fy_half` asks for a financial year + 1st/2nd half. Both hide the
   * generic Category / Financial Year / Tags controls.
   */
  dateInput?: DocDateInput;
  /** Hide the category picker (the slot fixes the category). */
  lockCategory?: boolean;
  onUploaded?: (doc: TaxDocument) => void;
}

export function DocumentUploader({
  entityType,
  entityId,
  defaultCategory = 'other',
  defaultLabel = '',
  defaultTags = [],
  compact = false,
  autoUpload = false,
  dateInput,
  lockCategory = false,
  onUploaded,
}: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState(defaultLabel);
  const [category, setCategory] = useState<DocumentCategory>(defaultCategory);
  const [fy, setFy] = useState(getCurrentFY());
  const [docDateValue, setDocDateValue] = useState(toInputDate(new Date()));
  const [half, setHalf] = useState<'H1' | 'H2'>('H1');
  const [tags, setTags] = useState<string[]>(defaultTags);
  const [tagInput, setTagInput] = useState('');
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // A slot upload (date/fy_half) replaces the generic metadata controls.
  const slotMode = !!dateInput;

  const requestUrl = useRequestUploadUrl();
  const createDoc = useCreateDocument();

  // Clean up any object URL created for image previews.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const accept = (selected: File) => {
    const error = validateFile(selected, ACCEPTED_FILE_TYPES, MAX_UPLOAD_SIZE);
    if (error) {
      toast.error(error);
      return;
    }
    setFile(selected);
    const resolvedLabel = label || labelFromFileName(selected.name);
    if (!label) setLabel(resolvedLabel);
    // Only auto-detect when the caller hasn't forced a specific category.
    const detected = detectCategory(selected.name);
    if (detected && defaultCategory === 'other') setCategory(detected);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return selected.type.startsWith('image/') ? URL.createObjectURL(selected) : null;
    });
    // Receipt-style flow: upload immediately so it can't be lost on form submit.
    if (autoUpload && !dateInput) {
      void handleUpload(selected, resolvedLabel);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) accept(dropped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && tags.length < 5 && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  const reset = () => {
    setFile(null);
    setLabel(defaultLabel);
    setTags(defaultTags);
    setProgress(0);
    setCategory(defaultCategory);
    setDocDateValue(toInputDate(new Date()));
    setHalf('H1');
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleUpload = async (uploadFile: File | null = file, uploadLabel: string = label) => {
    if (!uploadFile || !uploadLabel.trim()) {
      toast.error('Add a file and a label first');
      return;
    }
    if (dateInput === 'date' && !docDateValue) {
      toast.error('Pick the document date');
      return;
    }

    // Encode the slot's "when": a document date, or an FY + half. Both are kept
    // as tags alongside the slot key so the checklist can read them back.
    let finalTags = tags;
    let finalFy = fy;
    if (dateInput === 'date') {
      finalTags = [...tags.filter((t) => !t.toLowerCase().startsWith('date:')), dateTag(docDateValue)];
      finalFy = getCurrentFY(new Date(docDateValue));
    } else if (dateInput === 'fy_half') {
      finalTags = [...tags.filter((t) => !t.toLowerCase().startsWith('half:')), halfTag(half)];
    }

    setUploading(true);
    setProgress(0);
    try {
      const { upload_url, storage_key } = await requestUrl.mutateAsync({
        file_name: uploadFile.name,
        mime_type: uploadFile.type,
        file_size_kb: Math.ceil(uploadFile.size / 1024),
      });
      await uploadToR2(upload_url, uploadFile, setProgress);
      const doc = await createDoc.mutateAsync({
        label: uploadLabel.trim(),
        category,
        financial_year: finalFy,
        tags: finalTags,
        file_name: uploadFile.name,
        file_size: uploadFile.size,
        mime_type: uploadFile.type,
        storage_key,
        entity_type: entityType ?? null,
        entity_id: entityId ?? null,
      });
      onUploaded?.(doc);
      reset();
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!file ? (
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 text-center transition-colors',
            compact ? 'py-6' : 'py-10',
            dragging
              ? 'border-brand-navy bg-brand-navy/5'
              : 'border-surface-border bg-slate-50/50 hover:border-brand-navy/50',
          )}
        >
          <UploadCloud className="h-8 w-8 text-slate-600" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            Drag &amp; drop or <span className="text-brand-navy">browse</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-600">PDF, PNG, JPG up to 10 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) accept(selected);
            }}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-surface-border bg-white p-3">
          <div className="flex min-w-0 items-center gap-3">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="h-10 w-10 shrink-0 rounded-lg border border-surface-border object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-brand-danger">
                <FileText className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-600">{formatFileSize(file.size)}</p>
            </div>
          </div>
          {!uploading && (
            <button
              type="button"
              onClick={reset}
              aria-label="Remove file"
              className="rounded p-1 text-slate-600 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {file && (
        <>
          <div className="space-y-2">
            <Label htmlFor="doc-label">Label</Label>
            <Input
              id="doc-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Property Tax Receipt 2025"
            />
          </div>

          {/* Slot upload: ask for the document date. */}
          {dateInput === 'date' && (
            <div className="space-y-2">
              <Label htmlFor="doc-date">Document date</Label>
              <Input
                id="doc-date"
                type="date"
                value={docDateValue}
                onChange={(e) => setDocDateValue(e.target.value)}
              />
              <p className="text-xs text-slate-600">
                The date on the document itself (issue / registration date).
              </p>
            </div>
          )}

          {/* Slot upload: ask for the financial year + half (tax receipts). */}
          {dateInput === 'fy_half' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Financial Year</Label>
                <Select value={fy} onValueChange={setFy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getFYOptions().map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Period</Label>
                <Select value={half} onValueChange={(v) => setHalf(v as 'H1' | 'H2')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="H1">{HALF_LABEL.H1}</SelectItem>
                    <SelectItem value="H2">{HALF_LABEL.H2}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {!compact && !slotMode && (
            <div className="grid grid-cols-2 gap-3">
              {!lockCategory && (
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Financial Year</Label>
                <Select value={fy} onValueChange={setFy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getFYOptions().map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {!compact && !slotMode && (
            <div className="space-y-2">
              <Label htmlFor="doc-tags">Tags (max 5)</Label>
              <Input
                id="doc-tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Type a tag and press Enter"
                disabled={tags.length >= 5}
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((t) => (
                    <Badge key={t} variant="outline" className="gap-1">
                      {t}
                      <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {uploading && (
            <div className="space-y-1">
              <Progress value={progress} />
              <p className="text-right text-xs text-slate-600 tabular-nums">{progress}%</p>
            </div>
          )}

          <Button type="button" onClick={() => handleUpload()} disabled={uploading} className="w-full">
            {uploading ? 'Uploading…' : 'Upload document'}
          </Button>
        </>
      )}
    </div>
  );
}
