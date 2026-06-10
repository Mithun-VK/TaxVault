import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface SummaryStatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<any>;
  trend?: {
    value: number;
    isUp: boolean;
    label?: string;
  };
  colorVariant?: 'default' | 'danger' | 'success' | 'warning';
  className?: string;
}

export const SummaryStatCard: React.FC<SummaryStatCardProps> = ({
  label,
  value,
  icon: IconComponent,
  trend,
  colorVariant = 'default',
  className = '',
}) => {
  const borderColors = {
    default: 'border-surface-border',
    danger: 'border-l-4 border-l-[#991B1B]',
    success: 'border-l-4 border-l-[#14532D]',
    warning: 'border-l-4 border-l-[#92400E]',
  };

  const textColors = {
    default: 'text-brand-navy',
    danger: 'text-[#991B1B]',
    success: 'text-[#14532D]',
    warning: 'text-[#92400E]',
  };

  return (
    <Card className={`bg-surface-card border shadow-premium rounded-xl overflow-hidden ${borderColors[colorVariant]} ${className}`}>
      <CardContent className="p-5 flex items-center justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-semibold font-mono tracking-tight tabular-nums ${colorVariant === 'default' ? 'text-text-primary' : textColors[colorVariant]}`}>
            {value}
          </p>
          {trend && (
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full font-medium ${
                  trend.isUp
                    ? 'bg-[#F0FDF4] text-[#14532D]'
                    : 'bg-[#FEF2F2] text-[#991B1B]'
                }`}
              >
                {trend.isUp ? (
                  <ArrowUpRight size={12} className="mr-0.5" />
                ) : (
                  <ArrowDownRight size={12} className="mr-0.5" />
                )}
                {trend.value}%
              </span>
              <span className="text-text-muted">{trend.label || 'since last month'}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${
          colorVariant === 'default'
            ? 'bg-slate-50 text-brand-navy border border-[#E2E6ED]'
            : colorVariant === 'danger'
            ? 'bg-[#FEF2F2] text-[#991B1B]'
            : colorVariant === 'success'
            ? 'bg-[#F0FDF4] text-[#14532D]'
            : 'bg-[#FFFBEB] text-[#92400E]'
        }`}>
          <IconComponent size={20} className="shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
};
export default SummaryStatCard;
