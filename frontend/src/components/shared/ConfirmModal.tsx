import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
  /** When set, the user must type this exact string to enable the confirm button. */
  confirmText?: string;
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  destructive = false,
  confirmText,
  loading = false,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const blocked = confirmText ? typed !== confirmText : false;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped('');
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {confirmText && (
          <div className="space-y-2">
            <Label htmlFor="confirm-input">
              Type <span className="font-mono font-semibold text-slate-900">{confirmText}</span> to
              confirm
            </Label>
            <Input
              id="confirm-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={blocked || loading}
          >
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
