import { useState } from 'react';
import {
  Check,
  ClipboardCheck,
  Clock,
  CreditCard,
  Pencil,
  Receipt,
  Shield,
  Trash2,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  useApproveChangeRequest,
  useCancelChangeRequest,
  useChangeRequests,
  useRejectChangeRequest,
  type ChangeRequest,
  type ChangeStatus,
} from '@/api/changeRequests';
import { useCan } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/dates';
import type { ChangeEntityType } from '@/utils/permissions';

const ENTITY_META: Record<ChangeEntityType, { label: string; icon: LucideIcon }> = {
  bill: { label: 'Bill', icon: CreditCard },
  tax: { label: 'Tax', icon: Receipt },
  insurance: { label: 'Insurance', icon: Shield },
};

const STATUS_STYLE: Record<ChangeStatus, string> = {
  pending: 'text-amber-700',
  approved: 'text-brand-teal',
  rejected: 'text-brand-danger',
  cancelled: 'text-slate-600',
  expired: 'text-slate-600',
};

/** "12 min left", or null once the deadline has passed. */
function timeLeft(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const minutes = Math.ceil(ms / 60_000);
  return minutes <= 1 ? 'under a minute left' : `${minutes} min left`;
}

/** `provider_name` → `Provider name`. */
function humanizeKey(key: string): string {
  const words = key.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** What the request would do, field by field. */
function RequestedChange({ request }: { request: ChangeRequest }) {
  if (request.action === 'delete') {
    return (
      <p className="text-sm text-brand-danger">
        Delete this {ENTITY_META[request.entity_type].label.toLowerCase()}.
      </p>
    );
  }
  const entries = Object.entries(request.payload);
  if (entries.length === 0) {
    return <p className="text-sm text-slate-600">No fields listed.</p>;
  }
  return (
    <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="shrink-0 text-slate-600">{humanizeKey(key)}</dt>
          <dd className="min-w-0 truncate font-medium text-slate-900">{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function RequestCard({ request, canReview }: { request: ChangeRequest; canReview: boolean }) {
  const approve = useApproveChangeRequest();
  const reject = useRejectChangeRequest();
  const cancel = useCancelChangeRequest();
  const [note, setNote] = useState('');

  const meta = ENTITY_META[request.entity_type];
  const Icon = meta.icon;
  const ActionIcon = request.action === 'delete' ? Trash2 : Pencil;
  const isPending = request.status === 'pending';
  const remaining = timeLeft(request.expires_at);
  const busy = approve.isPending || reject.isPending || cancel.isPending;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <Icon className="h-[18px] w-[18px] text-slate-600" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">
              {request.entity_label ?? `${meta.label} (removed)`}
            </p>
            <p className="text-xs text-slate-600">
              {request.requested_by_name ?? 'A member'} · {formatDate(request.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <ActionIcon className="h-3 w-3" />
            {request.action === 'delete' ? 'Delete' : 'Edit'}
          </Badge>
          <Badge variant="outline" className={STATUS_STYLE[request.status]}>
            {humanizeKey(request.status)}
          </Badge>
          {isPending && remaining && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {remaining}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-surface-border bg-slate-50/60 p-3">
        <RequestedChange request={request} />
      </div>

      {request.reason && (
        <p className="text-sm text-slate-700">
          <span className="text-slate-600">Reason: </span>
          {request.reason}
        </p>
      )}

      {request.status !== 'pending' && request.reviewed_by_name && (
        <p className="text-xs text-slate-600">
          {humanizeKey(request.status)} by {request.reviewed_by_name}
          {request.reviewed_at ? ` on ${formatDate(request.reviewed_at)}` : ''}
          {request.review_note ? ` — ${request.review_note}` : ''}
        </p>
      )}

      {isPending && canReview && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            aria-label="Review note"
            className="h-10 min-w-[12rem] flex-1"
          />
          <Button
            variant="teal"
            disabled={busy}
            onClick={() => approve.mutate({ id: request.id, note: note || undefined })}
          >
            <Check className="h-4 w-4" /> Approve
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => reject.mutate({ id: request.id, note: note || undefined })}
          >
            <X className="h-4 w-4" /> Reject
          </Button>
        </div>
      )}

      {isPending && !canReview && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-600">Waiting for an admin to review.</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => cancel.mutate(request.id)}>
            <Undo2 className="h-4 w-4" /> Withdraw
          </Button>
        </div>
      )}
    </Card>
  );
}

function RequestList({
  requests,
  isLoading,
  canReview,
  emptyTitle,
  emptyDescription,
}: {
  requests: ChangeRequest[];
  isLoading: boolean;
  canReview: boolean;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (requests.length === 0) {
    return (
      <EmptyState icon={ClipboardCheck} title={emptyTitle} description={emptyDescription} />
    );
  }
  return (
    <div className="space-y-4">
      {requests.map((r) => (
        <RequestCard key={r.id} request={r} canReview={canReview} />
      ))}
    </div>
  );
}

/**
 * The approval queue. Admins and super admins see every member's pending edit
 * or deletion and sign it off; a member sees the ones they filed and can
 * withdraw anything still pending.
 */
export function Approvals() {
  const canReview = useCan('change_requests.review');
  const { data: all = [], isLoading } = useChangeRequests();

  const pending = all.filter((r) => r.status === 'pending');
  const decided = all.filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          {canReview ? 'Approvals' : 'My change requests'}
        </h1>
        <p className="mt-0.5 text-sm text-slate-700">
          {canReview
            ? 'Edits and deletions raised by members. Approving applies the change to the vault.'
            : 'Edits and deletions you have sent for approval.'}
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending{pending.length > 0 ? ` (${pending.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="decided">Reviewed</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <RequestList
            requests={pending}
            isLoading={isLoading}
            canReview={canReview}
            emptyTitle="Nothing waiting"
            emptyDescription={
              canReview
                ? 'No member has raised a change for approval.'
                : 'You have no changes waiting for approval.'
            }
          />
        </TabsContent>

        <TabsContent value="decided" className="mt-4">
          <RequestList
            requests={decided}
            isLoading={isLoading}
            canReview={canReview}
            emptyTitle="Nothing reviewed yet"
            emptyDescription="Approved, rejected and withdrawn requests appear here."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
