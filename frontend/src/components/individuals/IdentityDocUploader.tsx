import { useRef, useState } from 'react';
import { UploadCloud, FileText, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useIdentityDocUploadUrl } from '@/api/individuals';
import { uploadToR2, validateFile } from '@/utils/upload';
import { ACCEPTED_FILE_TYPES, MAX_UPLOAD_SIZE } from '@/utils/constants';
import type { IdentityDocType } from '@/types';

interface IdentityDocUploaderProps {
  individualId: string;
  docType: IdentityDocType;
  label: string;
  currentUrl?: string;
  onComplete: (storageKey: string) => void;
}

export function IdentityDocUploader({
  individualId,
  docType,
  label,
  currentUrl,
  onComplete,
}: IdentityDocUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const getUrl = useIdentityDocUploadUrl();

  const isImage = currentUrl ? /\.(png|jpe?g|webp)(\?|$)/i.test(currentUrl) : false;

  const handleFile = async (file: File) => {
    const error = validateFile(file, ACCEPTED_FILE_TYPES, MAX_UPLOAD_SIZE);
    if (error) {
      toast.error(error);
      return;
    }
    setUploading(true);
    setProgress(0);
    setDone(false);
    try {
      const { upload_url, storage_key } = await getUrl.mutateAsync({
        individualId,
        docType,
        fileName: file.name,
        mimeType: file.type,
      });
      await uploadToR2(upload_url, file, setProgress);
      setDone(true);
      onComplete(storage_key);
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {currentUrl && !uploading ? (
        <div className="flex items-center justify-between rounded-lg border border-surface-border bg-white p-3">
          <div className="flex min-w-0 items-center gap-3">
            {isImage ? (
              <img
                src={currentUrl}
                alt={label}
                className="h-11 w-11 shrink-0 rounded-lg border border-surface-border object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-brand-danger">
                <FileText className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{label} on file</p>
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand-navy hover:underline"
              >
                View / download
              </a>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
          >
            Replace
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-6 text-center transition-colors',
            'border-surface-border bg-slate-50/50 hover:border-brand-navy/50 disabled:opacity-60',
          )}
        >
          {done ? (
            <Check className="h-6 w-6 text-emerald-500" />
          ) : (
            <UploadCloud className="h-6 w-6 text-slate-600" />
          )}
          <p className="mt-1.5 text-sm font-medium text-slate-700">
            {done ? 'Uploaded' : `Upload ${label}`}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">JPG, PNG or PDF up to 10 MB</p>
        </button>
      )}

      {uploading && (
        <div className="space-y-1">
          <Progress value={progress} />
          <p className="text-right text-xs text-slate-600 tabular-nums">{progress}%</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
