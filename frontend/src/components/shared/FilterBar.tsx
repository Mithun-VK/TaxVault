import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-surface-border bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
    >
      {children}
    </div>
  );
}
