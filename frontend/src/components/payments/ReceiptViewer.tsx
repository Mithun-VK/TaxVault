import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useReceiptUrl } from '@/api/payments';
import { triggerDownload } from '@/api/documents';
import { formatDate } from '@/utils/dates';
import type { TaxDocument } from '@/types';

interface ReceiptViewerProps {
  /** Document id to preview; `null` keeps the viewer closed. */
  documentId: string | null;
  /** Metadata for the linked document, when available (label, mime, file name). */
  doc?: TaxDocument;
  onClose: () => void;
}

type Kind = 'image' | 'pdf' | 'other';

function resolveKind(doc?: TaxDocument): Kind {
  const mime = doc?.mime_type?.toLowerCase() ?? '';
  const name = doc?.file_name?.toLowerCase() ?? '';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) return 'image';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return 'other';
}

/**
 * View-first receipt preview. Opening a receipt renders it inline rather than
 * force-downloading it; the download lives inside the viewer so users only save
 * the file when they actually want it.
 *
 * The file URL is served with `X-Frame-Options: deny`, which blocks embedding it
 * directly in an <iframe>. Images aren't affected, so they use the URL directly;
 * PDFs are fetched into a same-origin blob: URL that framing is allowed to show.
 * If that fetch is blocked (CORS), we fall back to Open/Download, which never are.
 */
export function ReceiptViewer({ documentId, doc, onClose }: ReceiptViewerProps) {
  const receiptUrl = useReceiptUrl();
  // `rawUrl` is the presigned link (always safe for Download/Open); `blobUrl` is
  // the in-memory copy used for inline PDF framing.
  const [rawUrl, setRawUrl] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const open = documentId !== null;
  const label = doc?.label ?? 'Receipt';
  const kind = resolveKind(doc);

  useEffect(() => {
    if (!documentId) return;
    let active = true;
    let objectUrl: string | null = null;
    setStatus('loading');
    setRawUrl(null);
    setBlobUrl(null);

    (async () => {
      try {
        const url = await receiptUrl.mutateAsync(documentId);
        if (!active) return;
        setRawUrl(url);

        // Images render fine straight from the URL - no fetch/CORS needed.
        if (resolveKind(doc) !== 'pdf') {
          setStatus('ready');
          return;
        }

        // PDFs must be framed from a same-origin blob to dodge X-Frame-Options.
        const res = await fetch(url);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const blob = await res.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    })();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // receiptUrl mutation identity is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const canAct = !!rawUrl;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[85vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-surface-border p-4 pr-14">
          <div className="min-w-0">
            <DialogTitle className="truncate text-base">{label}</DialogTitle>
            <DialogDescription className="truncate text-xs">
              {doc?.file_name || 'Receipt'}
              {doc?.created_at ? ` · uploaded ${formatDate(doc.created_at)}` : ''}
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!canAct}
              onClick={() => rawUrl && window.open(rawUrl, '_blank', 'noopener')}
              className="hidden sm:inline-flex"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden md:inline">Open</span>
            </Button>
            <Button size="sm" disabled={!canAct} onClick={() => rawUrl && triggerDownload(rawUrl)}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100">
          {status === 'loading' ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading receipt…</p>
            </div>
          ) : status === 'error' ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center text-slate-600">
              <AlertCircle className="h-8 w-8 text-brand-warning" />
              <p className="max-w-xs text-sm">
                This receipt can’t be previewed inline. Use{' '}
                <span className="font-medium">Open</span> or{' '}
                <span className="font-medium">Download</span> above to view it.
              </p>
            </div>
          ) : kind === 'image' && rawUrl ? (
            <img src={rawUrl} alt={label} className="mx-auto max-h-full max-w-full object-contain" />
          ) : kind === 'pdf' && blobUrl ? (
            <iframe src={blobUrl} title={label} className="h-full w-full border-0" />
          ) : (
            <div className="flex flex-col items-center gap-3 p-8 text-center text-slate-600">
              <FileText className="h-10 w-10 text-slate-400" />
              <p className="text-sm">
                This file type can’t be previewed here.
                <br />
                Use Download or Open to view it.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
