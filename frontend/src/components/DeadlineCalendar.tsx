import React, { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Obligation } from '@/types';

interface DeadlineCalendarProps {
  obligations: Obligation[];
  onDateSelect?: (date: Date | null) => void;
  selectedDate?: Date | null;
  className?: string;
}

const taxColors: Record<string, string> = {
  income_tax: '#1A3C6E',
  land_tax: '#7C3AED',
  advance_tax: '#0369A1',
  gst: '#0F6E56',
  professional_tax: '#92400E',
  vehicle_tax: '#9D174D',
  other: '#475569',
};

export const DeadlineCalendar: React.FC<DeadlineCalendarProps> = ({
  obligations,
  onDateSelect,
  selectedDate,
  className = '',
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(2026, 5, 10)); // Fixed starting June 2026 for consistency with mocks

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getDayObligations = (day: Date) => {
    return obligations.filter((o) => {
      if (o.is_archived || o.status === 'paid' || o.status === 'exempt') return false;
      const oDate = parseISO(o.due_date);
      return isSameDay(oDate, day);
    });
  };

  const handleDayClick = (day: Date) => {
    if (onDateSelect) {
      if (selectedDate && isSameDay(day, selectedDate)) {
        onDateSelect(null); // Toggle off if clicked again
      } else {
        onDateSelect(day);
      }
    }
  };

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className={`p-4 bg-surface-card border border-[#E2E6ED] rounded-xl shadow-premium ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-brand-navy">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-md text-text-muted hover:bg-slate-50 border border-[#E2E6ED]"
            aria-label="Previous Month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded-md text-text-muted hover:bg-slate-50 border border-[#E2E6ED]"
            aria-label="Next Month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Week Day Header */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {weekDays.map((d, index) => (
          <span key={index} className="text-[11px] font-medium text-text-muted py-1">
            {d}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isDaySelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const isDayToday = isSameDay(day, new Date(2026, 5, 10)); // Treat June 10, 2026 as today
          const dayObligations = getDayObligations(day);

          let cellClass = 'relative flex flex-col items-center justify-center h-9 w-9 text-xs rounded-lg cursor-pointer transition-all ';

          if (!isCurrentMonth) {
            cellClass += 'text-slate-300 hover:bg-slate-50/50';
          } else if (isDaySelected) {
            cellClass += 'ring-2 ring-brand-navy text-brand-navy font-semibold bg-slate-50';
          } else if (isDayToday) {
            cellClass += 'bg-brand-navy text-white font-semibold hover:bg-brand-navy/90';
          } else {
            cellClass += 'text-text-primary hover:bg-slate-50 border border-transparent';
          }

          return (
            <div
              key={idx}
              onClick={() => handleDayClick(day)}
              className={cellClass}
            >
              <span className="tabular-nums">{format(day, 'd')}</span>
              
              {/* Dots */}
              {dayObligations.length > 0 && (
                <div className="absolute bottom-1 flex gap-0.5 justify-center max-w-[80%] overflow-hidden">
                  {dayObligations.slice(0, 3).map((obl) => (
                    <span
                      key={obl.id}
                      className="w-1 h-1 rounded-full shrink-0"
                      style={{
                        backgroundColor: taxColors[obl.tax_type] || taxColors.other,
                      }}
                    />
                  ))}
                  {dayObligations.length > 3 && (
                    <span className="text-[7px] leading-[4px] font-bold text-text-muted">+</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default DeadlineCalendar;
