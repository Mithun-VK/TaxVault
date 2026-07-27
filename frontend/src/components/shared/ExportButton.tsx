import { FileSpreadsheet } from 'lucide-react';

interface ExportButtonProps {
  onExport: () => void;
  disabled?: boolean;
  label?: string;
}

/** Compact "Export to Excel" action for list-page headers. */
export function ExportButton({ onExport, disabled, label = 'Export' }: ExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onExport}
      disabled={disabled}
      aria-label="Export to Excel"
      className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-sm text-slate-700 transition-colors duration-150 hover:bg-slate-50 hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
    >
      <FileSpreadsheet className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
