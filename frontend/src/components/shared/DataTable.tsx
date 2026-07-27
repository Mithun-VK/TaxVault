import { useState, type ReactNode } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  headClassName?: string;
  sortKey?: (row: T) => string | number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  loading?: boolean;
  loadingRows?: number;
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  onRowClick,
  emptyState,
  loading = false,
  loadingRows = 5,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ index: number; dir: 'asc' | 'desc' } | null>(null);

  const sortedData = (() => {
    if (!sort) return data;
    const col = columns[sort.index];
    if (!col?.sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = col.sortKey!(a);
      const bVal = col.sortKey!(b);
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  })();

  const toggleSort = (index: number) => {
    setSort((prev) =>
      prev?.index === index
        ? { index, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { index, dir: 'asc' },
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-surface-border bg-white">
      <Table aria-busy={loading}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col, i) => (
              <TableHead
                key={i}
                className={cn(col.sortKey && 'cursor-pointer select-none', col.headClassName)}
                onClick={col.sortKey ? () => toggleSort(i) : undefined}
                aria-sort={
                  sort?.index === i ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
                }
              >
                <span className="inline-flex items-center gap-1.5">
                  {col.header}
                  {col.sortKey && (
                    <span className="text-text-disabled">
                      {sort?.index === i ? (
                        sort.dir === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-brand-navy" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-brand-navy" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3" />
                      )}
                    </span>
                  )}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: loadingRows }).map((_, i) => (
              <TableRow key={i} className="hover:bg-transparent" aria-hidden="true">
                {columns.map((col, j) => (
                  <TableCell key={j} className={col.className}>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : sortedData.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-10 text-center text-text-muted">
                {emptyState ?? 'No records found.'}
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((row) => (
              <TableRow
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={cn(onRowClick && 'cursor-pointer focus-visible:bg-surface-page')}
              >
                {columns.map((col, i) => (
                  <TableCell key={i} className={col.className}>
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
