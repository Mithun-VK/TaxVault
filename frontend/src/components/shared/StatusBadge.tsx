import {
  Clock,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Ban,
  Archive,
} from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { getStatusLabel } from '@/utils/formatters';
import { cn } from '@/lib/utils';

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  pending: 'pending',
  overdue: 'overdue',
  paid: 'paid',
  active: 'active',
  exempt: 'exempt',
  lapsed: 'lapsed',
  matured: 'paid',
  cancelled: 'exempt',
  archived: 'exempt',
  upcoming: 'pending',
  settled: 'paid',
  approved: 'active',
  rejected: 'overdue',
  filed: 'pending',
  sent: 'paid',
  failed: 'overdue',
};

const STATUS_ICON: Record<string, typeof Clock> = {
  pending: Clock,
  overdue: AlertCircle,
  paid: CheckCircle2,
  active: ShieldCheck,
  exempt: Archive,
  lapsed: Ban,
  matured: CheckCircle2,
  cancelled: Archive,
  archived: Archive,
  upcoming: Clock,
  settled: CheckCircle2,
  approved: ShieldCheck,
  rejected: AlertCircle,
  filed: Clock,
  sent: CheckCircle2,
  failed: AlertCircle,
};

interface StatusBadgeProps {
  status: string;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  const variant = STATUS_VARIANT[status] ?? 'outline';
  const Icon = STATUS_ICON[status] ?? Clock;

  return (
    <Badge variant={variant} className={cn('gap-1.5', className)} role="status">
      {showIcon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {getStatusLabel(status)}
    </Badge>
  );
}
