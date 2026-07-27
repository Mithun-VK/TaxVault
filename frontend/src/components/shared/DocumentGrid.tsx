import { FileText, Download, MoreVertical, Trash2, Pencil, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { formatDate } from '@/utils/dates';
import { formatFileSize, getCategoryColor, getCategoryLabel } from '@/utils/formatters';
import type { TaxDocument } from '@/types';

interface DocumentGridProps {
  documents: TaxDocument[];
  view?: 'grid' | 'list';
  onDownload: (doc: TaxDocument) => void;
  // Optional: omitted for non-admins, who can view/download but not mutate.
  onDelete?: (doc: TaxDocument) => void;
  onRename?: (doc: TaxDocument) => void;
}

function Kebab({
  doc,
  onDownload,
  onDelete,
  onRename,
}: { doc: TaxDocument } & Pick<DocumentGridProps, 'onDownload' | 'onDelete' | 'onRename'>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Document actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onDownload(doc)}>
          <Download /> Download
        </DropdownMenuItem>
        {onRename && (
          <DropdownMenuItem onClick={() => onRename(doc)}>
            <Pencil /> Rename
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem destructive onClick={() => onDelete(doc)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DocumentGrid({
  documents,
  view = 'grid',
  onDownload,
  onDelete,
  onRename,
}: DocumentGridProps) {
  if (view === 'list') {
    return (
      <div className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-white">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-brand-danger">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{doc.label}</p>
              <p className="text-xs text-slate-600">
                {doc.file_name} · {formatFileSize(doc.file_size)} · {formatDate(doc.created_at)}
              </p>
            </div>
            <Badge
              variant="outline"
              style={{ color: getCategoryColor(doc.category) }}
              className="hidden sm:inline-flex"
            >
              {getCategoryLabel(doc.category)}
            </Badge>
            <span className="hidden text-xs text-slate-600 md:inline">{doc.financial_year}</span>
            <Button variant="ghost" size="icon" onClick={() => onDownload(doc)} aria-label="Download">
              <Download className="h-4 w-4" />
            </Button>
            <Kebab doc={doc} onDownload={onDownload} onDelete={onDelete} onRename={onRename} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex flex-col rounded-xl border border-surface-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-brand-danger">
              <FileText className="h-5 w-5" />
            </div>
            <Kebab doc={doc} onDownload={onDownload} onDelete={onDelete} onRename={onRename} />
          </div>
          <p className="mt-3 line-clamp-2 text-sm font-semibold text-slate-900">{doc.label}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" style={{ color: getCategoryColor(doc.category) }}>
              {getCategoryLabel(doc.category)}
            </Badge>
            <Badge variant="outline" className="text-slate-700">
              {doc.financial_year}
            </Badge>
          </div>
          {doc.entity_name && (
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-600">
              <Link2 className="h-3 w-3" /> {doc.entity_name}
            </p>
          )}
          <div className="mt-auto flex items-center justify-between pt-4">
            <span className="text-xs text-slate-600">
              {formatFileSize(doc.file_size)} · {formatDate(doc.created_at)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className={cn('text-brand-navy')}
              onClick={() => onDownload(doc)}
            >
              <Download className="h-4 w-4" /> Get
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
