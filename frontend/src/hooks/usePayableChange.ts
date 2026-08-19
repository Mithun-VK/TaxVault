import { useCreateChangeRequest, type ChangeRequestCreate } from '@/api/changeRequests';
import { useCan } from '@/hooks/usePermissions';
import {
  REQUEST_CHANGE_PERMISSION,
  type ChangeEntityType,
  type Permission,
} from '@/utils/permissions';

/**
 * How the signed-in role gets an edit or delete done on a bill, tax or policy.
 *
 * `direct`  - it changes the record itself (super admin).
 * `request` - it files a change request for an admin to approve (member).
 * `none`    - the control should not be offered at all (admin: no edit rights,
 *             and it must not be able to file a request it could then approve).
 */
export type ChangeMode = 'direct' | 'request' | 'none';

const EDIT_PERMISSION: Record<ChangeEntityType, Permission> = {
  bill: 'bills.edit',
  tax: 'taxes.edit',
  insurance: 'insurance.edit',
};

const DELETE_PERMISSION: Record<ChangeEntityType, Permission> = {
  bill: 'bills.delete',
  tax: 'taxes.delete',
  insurance: 'insurance.delete',
};

/**
 * Only the fields that actually changed, so the reviewer sees the edit rather
 * than the whole record. Values are compared as strings - the form returns
 * numbers and dates as text, while the API returns them typed - and blank,
 * null and undefined all count as "empty".
 */
export function diffPayload(
  original: object | undefined,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const normalise = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(v));
  const before = (original ?? {}) as Record<string, unknown>;
  const changed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    if (normalise(before[key]) !== normalise(value)) changed[key] = value;
  }
  return changed;
}

export interface PayableChange {
  /** How an edit would be applied for this role. */
  editMode: ChangeMode;
  /** How a delete would be applied for this role. */
  deleteMode: ChangeMode;
  /** True while a change request is being filed. */
  submitting: boolean;
  /** File an edit for approval. Sends only the fields that changed. */
  requestUpdate: (
    entityId: string,
    next: Record<string, unknown>,
    original?: object,
    reason?: string,
  ) => Promise<unknown>;
  /** File a deletion for approval. */
  requestDelete: (entityId: string, reason?: string) => Promise<unknown>;
}

export function usePayableChange(entityType: ChangeEntityType): PayableChange {
  const canEdit = useCan(EDIT_PERMISSION[entityType]);
  const canDelete = useCan(DELETE_PERMISSION[entityType]);
  const canRequest = useCan(REQUEST_CHANGE_PERMISSION[entityType]);
  const createRequest = useCreateChangeRequest();

  const mode = (direct: boolean): ChangeMode =>
    direct ? 'direct' : canRequest ? 'request' : 'none';

  const file = (data: ChangeRequestCreate) => createRequest.mutateAsync(data);

  return {
    editMode: mode(canEdit),
    deleteMode: mode(canDelete),
    submitting: createRequest.isPending,
    requestUpdate: (entityId, next, original, reason) =>
      file({
        entity_type: entityType,
        entity_id: entityId,
        action: 'update',
        payload: diffPayload(original, next),
        reason,
      }),
    requestDelete: (entityId, reason) =>
      file({ entity_type: entityType, entity_id: entityId, action: 'delete', reason }),
  };
}
