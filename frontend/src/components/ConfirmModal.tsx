import React, { useState, useEffect } from 'react';
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
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  dangerous?: boolean;
  confirmPhrase?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  dangerous = false,
  confirmPhrase = 'CONFIRM',
}) => {
  const [typedPhrase, setTypedPhrase] = useState('');

  // Reset typed text when modal opens/closes
  useEffect(() => {
    if (!open) {
      setTypedPhrase('');
    }
  }, [open]);

  const isConfirmed = !dangerous || typedPhrase.trim().toUpperCase() === confirmPhrase.toUpperCase();

  const handleConfirm = () => {
    if (isConfirmed) {
      onConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onCancel()}>
      <DialogContent className="sm:max-w-[420px] bg-surface-card border border-surface-border rounded-xl">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className={`text-base font-semibold ${dangerous ? 'text-[#991B1B]' : 'text-brand-navy'}`}>
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-text-muted">
            {message}
          </DialogDescription>
        </DialogHeader>

        {dangerous && (
          <div className="my-4 space-y-2">
            <Label htmlFor="confirm-input" className="text-xs font-medium text-text-primary">
              Please type <span className="font-semibold select-none font-mono">"{confirmPhrase}"</span> to confirm:
            </Label>
            <Input
              id="confirm-input"
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              placeholder={`Type ${confirmPhrase}`}
              className="text-sm border-[#E2E6ED] font-mono"
            />
          </div>
        )}

        <DialogFooter className="flex items-center gap-2 sm:justify-end mt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            className="text-xs h-9 font-medium border-[#E2E6ED] hover:bg-[#F0F4FA]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isConfirmed}
            className={`text-xs h-9 font-medium ${
              dangerous
                ? 'bg-[#991B1B] text-white hover:bg-[#801414] disabled:opacity-50'
                : 'bg-brand-navy text-white hover:bg-brand-navy/95'
            }`}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
export default ConfirmModal;
