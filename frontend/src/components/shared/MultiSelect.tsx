import { Check, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  label: string;
  value: string;
}

/**
 * Checkbox dropdown for choosing several values at once. An empty selection
 * means "all". Shared by the Reports grid filters and the Payments filters so
 * they look and behave identically.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  expanded,
  className,
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (v: string[]) => void;
  /** Stretch the trigger to fill its container (used inside filter grids). */
  expanded?: boolean;
  className?: string;
}) {
  const toggle = (val: string) =>
    onChange(
      selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val],
    );

  const triggerLabel =
    selected.length === 0
      ? `All ${label.toLowerCase()}`
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${label}: ${selected.length}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 justify-between font-normal',
            expanded ? 'w-full' : 'w-auto min-w-[8rem]',
            selected.length > 0 && 'border-brand-navy text-brand-navy',
            className,
          )}
          aria-label={label}
        >
          <span className="truncate">{triggerLabel}</span>
          <SlidersHorizontal className="ml-1 h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[60vh] w-56 overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-semibold text-slate-700">{label}</span>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-medium text-brand-navy hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        {options.length === 0 ? (
          <p className="px-2 py-2 text-sm text-slate-600">No options</p>
        ) : (
          options.map((o) => {
            const checked = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    checked ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-300',
                  )}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
                {o.label}
              </button>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
