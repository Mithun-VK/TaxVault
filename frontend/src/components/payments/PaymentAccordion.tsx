import { useMemo } from 'react';
import { parseISO, format, isValid } from 'date-fns';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { PaymentRow } from './PaymentRow';
import { formatINR } from '@/utils/formatters';
import type { Payment } from '@/types';

interface PaymentAccordionProps {
  payments: Payment[];
  onReceipt?: (documentId: string) => void;
}

interface Group {
  key: string;
  label: string;
  total: number;
  items: Payment[];
}

export function PaymentAccordion({ payments, onReceipt }: PaymentAccordionProps) {
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    payments.forEach((p) => {
      const d = parseISO(p.payment_date);
      const key = isValid(d) ? format(d, 'yyyy-MM') : 'unknown';
      const label = isValid(d) ? format(d, 'MMMM yyyy') : 'Undated';
      const group = map.get(key) ?? { key, label, total: 0, items: [] };
      group.items.push(p);
      group.total += p.amount_paid;
      map.set(key, group);
    });
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [payments]);

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-surface-border py-10 text-center text-sm text-slate-600">
        No payments recorded yet.
      </div>
    );
  }

  return (
    <Accordion
      type="multiple"
      defaultValue={groups.slice(0, 1).map((g) => g.key)}
      className="overflow-hidden rounded-xl border border-surface-border bg-white px-4"
    >
      {groups.map((group) => (
        <AccordionItem key={group.key} value={group.key}>
          <AccordionTrigger>
            <span className="flex w-full items-center justify-between pr-3">
              <span>{group.label}</span>
              <span className="font-mono text-sm tabular-nums text-slate-700">
                {formatINR(group.total)} · {group.items.length}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="divide-y divide-surface-border">
              {group.items.map((p) => (
                <PaymentRow key={p.id} payment={p} onReceipt={onReceipt} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
