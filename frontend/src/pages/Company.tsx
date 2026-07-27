import { Briefcase } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export function Company() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Company</h1>
        <p className="mt-0.5 text-sm text-slate-700">
          Business entities, GST, and company-owned assets
        </p>
      </div>
      <EmptyState
        icon={Briefcase}
        title="Company module coming soon"
        description="Company registration details, GST filings and company-held assets will live here in an upcoming release."
      />
    </div>
  );
}
