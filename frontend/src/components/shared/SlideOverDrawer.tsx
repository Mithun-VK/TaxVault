import type { ReactNode } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

interface SlideOverDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function SlideOverDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: SlideOverDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 shadow-drawer sm:max-w-[480px]"
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-surface-border bg-white px-6 py-4">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <div className="scrollbar-thin flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>

        {footer && (
          <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-surface-border bg-white px-6 py-4">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
