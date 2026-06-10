import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Search,
  Filter,
  Plus,
  X,
  FileSpreadsheet,
  AlertTriangle,
  FolderOpen,
  HelpCircle,
  Loader2,
} from 'lucide-react';

import {
  useObligations,
  useCreateObligation,
  useUpdateObligation,
  useArchiveObligation,
} from '@/api/obligations';
import { getFYOptions } from '@/utils/dates';

import { ObligationCard } from '@/components/ObligationCard';
import { SlideOverDrawer } from '@/components/SlideOverDrawer';
import { ConfirmModal } from '@/components/ConfirmModal';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Obligation } from '@/types';

// Form schema
const obligationSchema = z.object({
  tax_type: z.enum(['income_tax', 'land_tax', 'advance_tax', 'gst', 'professional_tax', 'vehicle_tax', 'other']),
  description: z.string().min(3, 'Description must be at least 3 characters.').max(200),
  assessment_year: z.string().regex(/^\d{4}-\d{2}$/, 'Must be in format YYYY-YY (e.g. 2024-25)'),
  jurisdiction: z.string().optional(),
  total_amount: z.preprocess((val) => Number(val), z.number().positive('Amount must be positive.')),
  due_date: z.string().min(1, 'Due date is required.'),
  recurrence_rule: z.enum(['NONE', 'ANNUAL', 'QUARTERLY', 'MONTHLY']).default('NONE'),
  notes: z.string().max(500).optional(),
});

type ObligationFormInputs = z.infer<typeof obligationSchema>;

export const ObligationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [taxTypeFilter, setTaxTypeFilter] = useState('All');
  const [fyFilter, setFyFilter] = useState('All');

  // Query and Mutation Hooks
  const { data: obligations = [], isLoading } = useObligations({
    search: searchQuery,
    status: statusFilter,
    tax_type: taxTypeFilter === 'All' ? undefined : taxTypeFilter,
    fy: fyFilter === 'All' ? undefined : fyFilter,
  });

  const createMutation = useCreateObligation();
  const updateMutation = useUpdateObligation();
  const archiveMutation = useArchiveObligation();

  // Dialog & Drawer Open state
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedObligation, setSelectedObligation] = useState<Obligation | null>(null);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);

  // Form setup
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<ObligationFormInputs>({
    resolver: zodResolver(obligationSchema),
    defaultValues: { recurrence_rule: 'NONE' },
  });

  // FY list options
  const fyOptions = useMemo(() => getFYOptions(), []);

  // Intercept query parameters (e.g., ?edit=id or ?archive=id) to toggle states
  useEffect(() => {
    const editId = searchParams.get('edit');
    const archiveId = searchParams.get('archive');

    if (editId) {
      const item = obligations.find((o) => o.id === editId);
      if (item) {
        handleOpenEdit(item);
      }
    } else if (archiveId) {
      const item = obligations.find((o) => o.id === archiveId);
      if (item) {
        handleOpenArchive(item);
      }
    }
  }, [searchParams, obligations]);

  const handleOpenCreate = () => {
    setDrawerMode('create');
    setSelectedObligation(null);
    reset({
      tax_type: 'income_tax',
      description: '',
      assessment_year: '2025-26',
      jurisdiction: '',
      total_amount: undefined,
      due_date: '',
      recurrence_rule: 'NONE',
      notes: '',
    });
    setDrawerOpen(true);
  };

  const handleOpenEdit = (o: Obligation) => {
    setDrawerMode('edit');
    setSelectedObligation(o);
    reset({
      tax_type: o.tax_type,
      description: o.description,
      assessment_year: o.assessment_year,
      jurisdiction: o.jurisdiction || '',
      total_amount: o.total_amount,
      due_date: o.due_date.slice(0, 10), // Date input needs YYYY-MM-DD
      recurrence_rule: o.recurrence_rule,
      notes: o.notes || '',
    });
    setDrawerOpen(true);
  };

  const handleOpenArchive = (o: Obligation) => {
    setSelectedObligation(o);
    setArchiveModalOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedObligation(null);
    reset();
    
    // Clear URL parameters
    const params = new URLSearchParams(searchParams);
    params.delete('edit');
    setSearchParams(params);
  };

  const handleCloseArchive = () => {
    setArchiveModalOpen(false);
    setSelectedObligation(null);

    // Clear URL parameters
    const params = new URLSearchParams(searchParams);
    params.delete('archive');
    setSearchParams(params);
  };

  // Submit handers
  const onSubmit = (data: ObligationFormInputs) => {
    if (drawerMode === 'create') {
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success('Obligation created successfully.');
          handleCloseDrawer();
        },
        onError: (err: any) => {
          toast.error(err.message || 'Failed to create obligation.');
        },
      });
    } else if (drawerMode === 'edit' && selectedObligation) {
      updateMutation.mutate(
        { id: selectedObligation.id, updates: data },
        {
          onSuccess: () => {
            toast.success('Obligation details updated.');
            handleCloseDrawer();
          },
          onError: (err: any) => {
            toast.error(err.message || 'Failed to update details.');
          },
        }
      );
    }
  };

  const confirmArchive = () => {
    if (selectedObligation) {
      archiveMutation.mutate(selectedObligation.id, {
        onSuccess: () => {
          toast.success(`Obligation "${selectedObligation.description}" archived.`);
          handleCloseArchive();
        },
        onError: (err: any) => {
          toast.error(err.message || 'Failed to archive obligation.');
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── FILTER & SEARCH BAR ── */}
      <div className="bg-white p-4 rounded-xl border border-surface-border shadow-premium flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search size={16} className="absolute left-3 top-3 text-text-muted" />
            <Input
              placeholder="Search by description or agency..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm border-[#E2E6ED]"
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-xs border-[#E2E6ED]">
                <SelectValue placeholder="Status: All" />
              </SelectTrigger>
              <SelectContent className="bg-white border text-xs">
                <SelectItem value="All">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Exempt">Exempt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tax Type Filter */}
          <div className="space-y-1">
            <Select value={taxTypeFilter} onValueChange={setTaxTypeFilter}>
              <SelectTrigger className="text-xs border-[#E2E6ED]">
                <SelectValue placeholder="Tax Type: All" />
              </SelectTrigger>
              <SelectContent className="bg-white border text-xs">
                <SelectItem value="All">All Tax Types</SelectItem>
                <SelectItem value="income_tax">Income Tax</SelectItem>
                <SelectItem value="land_tax">Property & Land Tax</SelectItem>
                <SelectItem value="advance_tax">Advance Tax</SelectItem>
                <SelectItem value="gst">GST</SelectItem>
                <SelectItem value="professional_tax">Professional Tax</SelectItem>
                <SelectItem value="vehicle_tax">Vehicle Road Tax</SelectItem>
                <SelectItem value="other">Other Tax</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* FY Filter */}
          <div className="space-y-1">
            <Select value={fyFilter} onValueChange={setFyFilter}>
              <SelectTrigger className="text-xs border-[#E2E6ED]">
                <SelectValue placeholder="FY: All" />
              </SelectTrigger>
              <SelectContent className="bg-white border text-xs">
                <SelectItem value="All">All FYs</SelectItem>
                {fyOptions.map((fy) => (
                  <SelectItem key={fy} value={fy}>
                    FY {fy}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action button header row */}
        <div className="flex items-center justify-between border-t border-[#E2E6ED] pt-3.5">
          <span className="text-xs text-text-muted font-medium">
            Found <span className="font-semibold text-text-primary">{obligations.length}</span> records
          </span>
          <Button
            onClick={handleOpenCreate}
            className="bg-brand-navy hover:bg-[#153264] text-white flex items-center gap-2 text-xs font-semibold px-4 py-2 h-9 rounded-lg"
          >
            <Plus size={16} />
            <span>Add Obligation</span>
          </Button>
        </div>
      </div>

      {/* ── RESPONSIVE GRID ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={36} className="animate-spin text-brand-navy" />
        </div>
      ) : obligations.length === 0 ? (
        /* Empty State Illustration */
        <div className="bg-white border rounded-xl shadow-premium p-12 text-center flex flex-col items-center justify-center space-y-4 max-w-lg mx-auto">
          <div className="w-28 h-28 bg-[#F8FAFC] border rounded-full flex items-center justify-center text-slate-300">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M12 9v6M9 12h6" />
            </svg>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-brand-navy">No obligations found</h3>
            <p className="text-xs text-text-muted max-w-sm leading-relaxed">
              No tax obligations matched your search parameters. Try adjusting filters or create a new obligation.
            </p>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="bg-brand-navy text-white text-xs h-9 font-medium px-4"
          >
            Create Obligation
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {obligations.map((o) => (
            <ObligationCard
              key={o.id}
              obligation={o}
              onEdit={handleOpenEdit}
              onLogPayment={(item) => navigate(`/payments?log=${item.id}`)}
              onArchive={handleOpenArchive}
            />
          ))}
        </div>
      )}

      {/* ── CREATE / EDIT SLIDEOVER ── */}
      <SlideOverDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        title={drawerMode === 'create' ? 'Create Tax Obligation' : 'Edit Obligation Details'}
        footer={
          <>
            <Button
              variant="outline"
              onClick={handleCloseDrawer}
              className="text-xs h-9 border-[#E2E6ED] hover:bg-[#F0F4FA]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit(onSubmit)}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-brand-navy text-white text-xs h-9 hover:bg-[#153264]"
            >
              {drawerMode === 'create' ? 'Confirm' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tax Type</Label>
            <Select
              defaultValue="income_tax"
              value={selectedObligation ? selectedObligation.tax_type : undefined}
              onValueChange={(val) => setValue('tax_type', val as any)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="bg-white border z-50 text-xs">
                <SelectItem value="income_tax">Income Tax</SelectItem>
                <SelectItem value="land_tax">Property & Land Tax</SelectItem>
                <SelectItem value="advance_tax">Advance Tax</SelectItem>
                <SelectItem value="gst">GST</SelectItem>
                <SelectItem value="professional_tax">Professional Tax</SelectItem>
                <SelectItem value="vehicle_tax">Vehicle Road Tax</SelectItem>
                <SelectItem value="other">Other Tax</SelectItem>
              </SelectContent>
            </Select>
            {errors.tax_type && (
              <span className="text-[10px] text-brand-danger font-medium">{errors.tax_type.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Description</Label>
            <Input
              placeholder="e.g. Income Tax Self-Assessment"
              className="text-sm border-surface-border"
              {...register('description')}
            />
            {errors.description && (
              <span className="text-[10px] text-brand-danger font-medium">{errors.description.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Assessment Year</Label>
            <Input
              placeholder="e.g. 2026-27"
              className="text-sm border-surface-border"
              {...register('assessment_year')}
            />
            {errors.assessment_year && (
              <span className="text-[10px] text-brand-danger font-medium">{errors.assessment_year.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Jurisdiction / Agency</Label>
            <Input
              placeholder="e.g. Income Tax Ward 1(1) Mumbai"
              className="text-sm border-surface-border"
              {...register('jurisdiction')}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Total Amount (₹)</Label>
            <Input
              type="number"
              placeholder="125000"
              className="text-sm font-mono border-surface-border"
              {...register('total_amount')}
            />
            {errors.total_amount && (
              <span className="text-[10px] text-brand-danger font-medium">{errors.total_amount.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Due Date</Label>
            <Input
              type="date"
              className="text-sm border-surface-border"
              {...register('due_date')}
            />
            {errors.due_date && (
              <span className="text-[10px] text-brand-danger font-medium">{errors.due_date.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Recurrence Rule</Label>
            <Select
              defaultValue="NONE"
              value={selectedObligation ? selectedObligation.recurrence_rule : undefined}
              onValueChange={(val) => setValue('recurrence_rule', val as any)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Recurrence" />
              </SelectTrigger>
              <SelectContent className="bg-white border z-50 text-xs">
                <SelectItem value="NONE">None</SelectItem>
                <SelectItem value="ANNUAL">Annual</SelectItem>
                <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes</Label>
            <textarea
              rows={3}
              placeholder="Additional assessment comments..."
              className="w-full text-sm border border-surface-border p-2 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-navy"
              {...register('notes')}
            />
          </div>
        </div>
      </SlideOverDrawer>

      {/* ── CONFIRM ARCHIVE MODAL ── */}
      <ConfirmModal
        open={archiveModalOpen}
        title="Archive Tax Obligation"
        message={`Are you sure you want to archive "${selectedObligation?.description || 'this obligation'}"? Archived obligations are stored historically and will not show on active dashboard schedules.`}
        confirmLabel="Archive Record"
        onConfirm={confirmArchive}
        onCancel={handleCloseArchive}
        dangerous={true}
        confirmPhrase="CONFIRM"
      />
    </div>
  );
};
export default ObligationsPage;
