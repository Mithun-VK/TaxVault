import { useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  isToday,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toInputDate } from '@/utils/dates';
import type { Payable } from '@/types';

interface DeadlineCalendarProps {
  byDate: Map<string, Payable[]>;
  selectedDate: string | null;
  onSelectDate: (key: string | null) => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function DeadlineCalendar({ byDate, selectedDate, onSelectDate }: DeadlineCalendarProps) {
  const [cursor, setCursor] = useState(() => new Date());

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = getDay(monthStart);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{format(cursor, 'MMMM yyyy')}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor((c) => subMonths(c, 1))}
            aria-label="Previous month"
            className="rounded-md p-1.5 text-slate-700 hover:bg-slate-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="rounded-md px-2 py-1 text-xs font-medium text-brand-navy hover:bg-slate-100"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="Next month"
            className="rounded-md p-1.5 text-slate-700 hover:bg-slate-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => (
          <div key={`wd-${i}`} className="flex h-8 items-center justify-center text-xs font-medium text-slate-600">
            {d}
          </div>
        ))}

        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} className="h-10" />
        ))}

        {days.map((day) => {
          const key = toInputDate(day);
          const items = byDate.get(key) ?? [];
          const hasItems = items.length > 0;
          const hasOverdue = items.some((p) => p.status === 'overdue');
          const today = isToday(day);
          const selected = selectedDate === key;
          const inMonth = isSameMonth(day, cursor);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(selected ? null : key)}
              className={cn(
                'relative flex h-10 flex-col items-center justify-center rounded-lg text-sm transition-colors',
                today
                  ? 'bg-brand-navy font-semibold text-white'
                  : 'text-slate-700 hover:bg-slate-100',
                selected && !today && 'ring-2 ring-brand-navy',
                !inMonth && 'text-slate-500',
              )}
            >
              <span>{format(day, 'd')}</span>
              {hasItems && (
                <span
                  className={cn(
                    'absolute bottom-1 h-1.5 w-1.5 rounded-full',
                    today ? 'bg-white' : hasOverdue ? 'bg-brand-danger' : 'bg-brand-teal',
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
