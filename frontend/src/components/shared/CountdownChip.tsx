import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { daysUntil, formatDate } from '@/utils/dates';

interface CountdownChipProps {
  date: string;
  className?: string;
  showIcon?: boolean;
}

export function CountdownChip({ date, className, showIcon = true }: CountdownChipProps) {
  const days = daysUntil(date);

  let label: string;
  let classes: string;
  let dotClass: string;
  let Icon = Clock;
  let ariaLabel: string;

  if (days < 0) {
    label = `Overdue ${Math.abs(days)}d`;
    classes = 'bg-red-50 text-red-700 border-red-200';
    dotClass = 'bg-red-500 animate-pulse-dot';
    Icon = AlertTriangle;
    ariaLabel = `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}, was due ${formatDate(date)}`;
  } else if (days === 0) {
    label = 'Due today';
    classes = 'bg-red-50 text-red-700 border-red-200';
    dotClass = 'bg-red-500 animate-pulse-dot';
    Icon = AlertTriangle;
    ariaLabel = 'Due today';
  } else if (days <= 3) {
    label = `${days} day${days === 1 ? '' : 's'}`;
    classes = 'bg-red-50 text-red-700 border-red-200';
    dotClass = 'bg-red-400';
    Icon = Clock;
    ariaLabel = `Due in ${days} day${days === 1 ? '' : 's'}, on ${formatDate(date)}`;
  } else if (days <= 30) {
    label = `${days} days`;
    classes = 'bg-amber-50 text-amber-800 border-amber-200';
    dotClass = 'bg-amber-500';
    Icon = Clock;
    ariaLabel = `Due in ${days} days, on ${formatDate(date)}`;
  } else {
    label = `${days} days`;
    classes = 'bg-green-50 text-green-800 border-green-200';
    dotClass = 'bg-green-500';
    Icon = CheckCircle2;
    ariaLabel = `Due in ${days} days, on ${formatDate(date)}`;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums',
        classes,
        className,
      )}
      aria-label={ariaLabel}
      title={formatDate(date)}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)} aria-hidden="true" />
      {showIcon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {label}
    </span>
  );
}
