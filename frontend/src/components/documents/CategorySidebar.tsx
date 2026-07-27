import { cn } from '@/lib/utils';
import { DOCUMENT_CATEGORIES } from '@/utils/constants';
import type { DocumentCategory, TaxDocument } from '@/types';

interface CategorySidebarProps {
  documents: TaxDocument[];
  selected: DocumentCategory | 'all';
  onSelect: (category: DocumentCategory | 'all') => void;
}

export function CategorySidebar({ documents, selected, onSelect }: CategorySidebarProps) {
  const countFor = (cat: DocumentCategory) => documents.filter((d) => d.category === cat).length;

  return (
    <nav className="space-y-1">
      <button
        type="button"
        onClick={() => onSelect('all')}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          selected === 'all' ? 'bg-brand-navy/10 text-brand-navy' : 'text-slate-600 hover:bg-slate-50',
        )}
      >
        All documents
        <span className="text-xs text-slate-600">{documents.length}</span>
      </button>
      {DOCUMENT_CATEGORIES.map((cat) => {
        const count = countFor(cat.value);
        return (
          <button
            key={cat.value}
            type="button"
            onClick={() => onSelect(cat.value)}
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              selected === cat.value
                ? 'bg-brand-navy/10 text-brand-navy'
                : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
              {cat.label}
            </span>
            <span className="text-xs text-slate-600">{count}</span>
          </button>
        );
      })}
    </nav>
  );
}
