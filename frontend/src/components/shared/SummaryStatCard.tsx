import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Accent = 'navy' | 'teal' | 'danger' | 'warning' | 'slate';

interface AccentStyle {
  chip: string;
  bar: string;
  glow: string;
}

const STYLES: Record<Accent, AccentStyle> = {
  navy: {
    chip: 'bg-brand-navy-muted text-brand-navy ring-brand-navy/10',
    bar: 'from-brand-navy/70',
    glow: 'bg-brand-navy',
  },
  teal: {
    chip: 'bg-brand-teal-muted text-brand-teal ring-brand-teal/10',
    bar: 'from-brand-teal/70',
    glow: 'bg-brand-teal',
  },
  danger: {
    chip: 'bg-red-50 text-brand-danger ring-brand-danger/10',
    bar: 'from-brand-danger/70',
    glow: 'bg-brand-danger',
  },
  warning: {
    chip: 'bg-amber-50 text-brand-warning ring-brand-warning/10',
    bar: 'from-brand-warning/70',
    glow: 'bg-brand-warning',
  },
  slate: {
    chip: 'bg-slate-100 text-slate-600 ring-slate-300/30',
    bar: 'from-slate-400/60',
    glow: 'bg-slate-400',
  },
};

interface SummaryStatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  accent?: Accent;
  sublabel?: string;
  loading?: boolean;
  valueClassName?: string;
}

export function SummaryStatCard({
  label,
  value,
  icon: Icon,
  accent = 'navy',
  sublabel,
  loading = false,
  valueClassName,
}: SummaryStatCardProps) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3.5 h-8 w-32" />
        <Skeleton className="mt-2.5 h-3 w-16" />
      </Card>
    );
  }

  const style = STYLES[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card className="group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
        {/* Top accent bar */}
        <div
          aria-hidden="true"
          className={cn('absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r to-transparent', style.bar)}
        />
        {/* Soft corner wash */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full opacity-[0.06] blur-2xl transition-opacity duration-200 group-hover:opacity-[0.12]',
            style.glow,
          )}
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className={cn(
                'mt-2 font-mono text-[26px] font-semibold leading-none tabular-nums tracking-tight text-text-primary',
                valueClassName,
              )}
            >
              {value}
            </motion.p>
            {sublabel && <p className="mt-2 text-xs text-text-disabled">{sublabel}</p>}
          </div>
          {Icon && (
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-105',
                style.chip,
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
