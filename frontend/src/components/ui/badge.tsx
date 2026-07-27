import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-brand-navy text-white',
        pending: 'bg-status-pending-bg text-status-pending border-status-pending-border',
        overdue: 'bg-status-overdue-bg text-status-overdue border-status-overdue-border',
        paid: 'bg-status-paid-bg text-status-paid border-status-paid-border',
        active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        exempt: 'bg-slate-50 text-slate-600 border-slate-200',
        lapsed: 'bg-orange-50 text-orange-700 border-orange-200',
        warning: 'bg-status-warning-bg text-status-warning border-status-warning-border',
        outline: 'border-surface-border text-slate-600',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
