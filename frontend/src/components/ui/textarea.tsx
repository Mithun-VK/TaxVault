import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[80px] w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-600 focus-visible:outline-none focus-visible:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/30 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
