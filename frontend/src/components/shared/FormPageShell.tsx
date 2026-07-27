import type { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * Full-page create/edit layout: breadcrumb + title, the form in a card, and a
 * sticky-feeling action bar (Cancel / Save). Replaces the right-side drawers so
 * CRUD reads as a dedicated page. The form itself lives in `children` and is
 * submitted via `form={formId}` on the Save button.
 */
export function FormPageShell({
  breadcrumbs,
  title,
  description,
  formId,
  submitting,
  submitLabel,
  onCancel,
  children,
}: {
  breadcrumbs: { label: string; to?: string }[];
  title: string;
  description?: string;
  formId: string;
  submitting?: boolean;
  submitLabel: string;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <Breadcrumbs items={breadcrumbs} />
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
      </div>
      <Card className="p-6">{children}</Card>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" form={formId} disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </div>
  );
}
