import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { usePayableChange } from '@/hooks/usePayableChange';
import type { ChangeEntityType } from '@/utils/permissions';

interface PayableActionsProps {
  entityType: ChangeEntityType;
  entityId: string;
  /** Name shown in the delete confirmation. */
  entityName: string;
  /** Where the edit form lives, e.g. `/bills/abc/edit`. */
  editPath: string;
  /** Applies a direct delete. Omit for roles that can only request one. */
  onDelete?: () => void;
  deleting?: boolean;
}

/**
 * Edit and delete for a bill, tax or policy, adapted to what the role may do:
 * a super admin acts directly, a member's action is filed for approval, and an
 * admin - who may neither edit nor approve their own request - sees neither.
 */
export function PayableActions({
  entityType,
  entityId,
  entityName,
  editPath,
  onDelete,
  deleting = false,
}: PayableActionsProps) {
  const navigate = useNavigate();
  const change = usePayableChange(entityType);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const requestingDelete = change.deleteMode === 'request';

  const confirmDelete = async () => {
    if (requestingDelete) {
      await change.requestDelete(entityId);
    } else {
      onDelete?.();
    }
    setConfirmOpen(false);
  };

  const showDelete =
    change.deleteMode === 'request' || (change.deleteMode === 'direct' && !!onDelete);

  return (
    <>
      {change.editMode !== 'none' && (
        <Button variant="outline" onClick={() => navigate(editPath)}>
          {change.editMode === 'request' ? (
            <>
              <Send className="h-4 w-4" /> Request edit
            </>
          ) : (
            <>
              <Pencil className="h-4 w-4" /> Edit
            </>
          )}
        </Button>
      )}

      {showDelete && (
        <Button variant="outline" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="h-4 w-4" />
          {requestingDelete ? 'Request deletion' : 'Delete'}
        </Button>
      )}

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={requestingDelete ? 'Send deletion for approval?' : `Delete ${entityName}?`}
        description={
          requestingDelete
            ? `An admin has to approve this before ${entityName} is removed. Nothing changes until then.`
            : `${entityName} will be removed from the vault. This cannot be undone.`
        }
        confirmLabel={requestingDelete ? 'Send for approval' : 'Delete'}
        destructive={!requestingDelete}
        loading={change.submitting || deleting}
        onConfirm={confirmDelete}
      />
    </>
  );
}
