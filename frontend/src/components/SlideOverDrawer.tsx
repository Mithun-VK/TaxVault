import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface SlideOverDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const SlideOverDrawer: React.FC<SlideOverDrawerProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
}) => {
  return (
    <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
      <SheetContent className="w-full sm:max-w-[480px] flex flex-col h-full bg-surface-card p-0 border-l border-surface-border" side="right">
        <SheetHeader className="p-6 border-b border-[#E2E6ED]">
          <SheetTitle className="text-lg font-semibold text-brand-navy">{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
        {footer && (
          <div className="p-4 border-t border-[#E2E6ED] bg-slate-50 flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
export default SlideOverDrawer;
