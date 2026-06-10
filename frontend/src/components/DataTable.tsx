import React, { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyState,
  className = '',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aString = String(aVal).toLowerCase();
      const bString = String(bVal).toLowerCase();

      if (aString < bString) return sortDirection === 'asc' ? -1 : 1;
      if (aString > bString) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDirection]);

  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-surface-border bg-surface-card shadow-premium ${className}`}>
      <table className="w-full text-left border-collapse min-w-[640px]">
        {/* Header */}
        <thead className="bg-slate-50 border-b border-surface-border text-xs text-text-muted font-medium sticky top-0 z-10">
          <tr>
            {columns.map((col, index) => {
              const isSorted = col.accessorKey && sortKey === col.accessorKey;
              return (
                <th
                  key={index}
                  className="px-6 py-4 select-none font-semibold text-brand-navy"
                >
                  {col.sortable && col.accessorKey ? (
                    <button
                      onClick={() => handleSort(col.accessorKey!)}
                      className="inline-flex items-center gap-1 hover:text-text-primary transition-colors focus-visible:outline-none"
                    >
                      {col.header}
                      {isSorted ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="text-slate-300" />
                      )}
                    </button>
                  ) : (
                    <span>{col.header}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Body */}
        <tbody className="text-sm divide-y divide-surface-border">
          {loading ? (
            // Skeleton Loader (3 rows)
            Array.from({ length: 3 }).map((_, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50/20">
                {columns.map((_, cIdx) => (
                  <td key={cIdx} className="px-6 py-4">
                    <Skeleton className="h-4 w-4/5 rounded bg-slate-100" />
                  </td>
                ))}
              </tr>
            ))
          ) : sortedData.length === 0 ? (
            // Empty State
            <tr>
              <td colSpan={columns.length} className="px-6 py-10 text-center">
                {emptyState || (
                  <div className="flex flex-col items-center justify-center space-y-2 text-text-muted">
                    <p>No records found.</p>
                  </div>
                )}
              </td>
            </tr>
          ) : (
            // Data Rows
            sortedData.map((row, rIdx) => (
              <tr
                key={rIdx}
                className={`hover:bg-[#F0F4FA]/40 transition-colors ${
                  rIdx % 2 !== 0 ? 'bg-[#F8F9FB]' : 'bg-surface-card'
                }`}
              >
                {columns.map((col, cIdx) => (
                  <td key={cIdx} className="px-6 py-4 text-text-primary">
                    {col.cell ? (
                      col.cell(row)
                    ) : col.accessorKey ? (
                      <span className={typeof row[col.accessorKey] === 'number' ? 'font-mono' : ''}>
                        {row[col.accessorKey]}
                      </span>
                    ) : (
                      null
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
export default DataTable;
