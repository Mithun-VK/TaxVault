import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface AssetLinkedItemsProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  emptyText: string;
  onAdd?: () => void;
  addLabel?: string;
  loading?: boolean;
}

export function AssetLinkedItems<T>({
  items,
  getKey,
  renderItem,
  emptyText,
  onAdd,
  addLabel = 'Add',
  loading = false,
}: AssetLinkedItemsProps<T>) {
  return (
    <div className="space-y-3">
      {onAdd && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4" /> {addLabel}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-surface-border py-10 text-center text-sm text-slate-600">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={getKey(item)}
              className="rounded-lg border border-surface-border bg-white p-3"
            >
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
