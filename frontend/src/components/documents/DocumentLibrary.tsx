import { useMemo, useState } from 'react';
import { LayoutGrid, List, Plus, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/shared/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { CategorySidebar } from './CategorySidebar';
import { DocumentGrid } from '@/components/shared/DocumentGrid';
import { useDebounce } from '@/hooks/useDebounce';
import type { DocumentCategory, TaxDocument } from '@/types';

interface DocumentLibraryProps {
  documents: TaxDocument[];
  onDownload: (doc: TaxDocument) => void;
  onDelete: (doc: TaxDocument) => void;
  onRename?: (doc: TaxDocument) => void;
  onUploadClick: () => void;
}

export function DocumentLibrary({
  documents,
  onDownload,
  onDelete,
  onRename,
  onUploadClick,
}: DocumentLibraryProps) {
  const [category, setCategory] = useState<DocumentCategory | 'all'>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return documents.filter((d) => {
      const matchCat = category === 'all' || d.category === category;
      const matchSearch =
        !q ||
        d.label.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [documents, category, debounced]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="lg:border-r lg:border-surface-border lg:pr-4">
        <CategorySidebar documents={documents} selected={category} onSelect={setCategory} />
      </aside>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search documents and tags…"
            className="flex-1"
          />
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-surface-border p-0.5">
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-label="Grid view"
                className={cn(
                  'rounded-md p-1.5',
                  view === 'grid' ? 'bg-slate-100 text-brand-navy' : 'text-slate-600',
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                aria-label="List view"
                className={cn(
                  'rounded-md p-1.5',
                  view === 'list' ? 'bg-slate-100 text-brand-navy' : 'text-slate-600',
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={onUploadClick}>
              <Plus className="h-4 w-4" /> Upload
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No documents here"
            description="Upload statements, receipts and certificates to keep them safe and searchable."
            action={
              <Button onClick={onUploadClick}>
                <Plus className="h-4 w-4" /> Upload a document
              </Button>
            }
          />
        ) : (
          <DocumentGrid
            documents={filtered}
            view={view}
            onDownload={onDownload}
            onDelete={onDelete}
            onRename={onRename}
          />
        )}
      </div>
    </div>
  );
}
