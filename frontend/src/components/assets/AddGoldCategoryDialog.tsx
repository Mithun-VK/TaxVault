import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { slugifyCategory } from '@/utils/constants';
import { builtinGoldCategories } from '@/utils/gold';
import { useGoldCategories, useCreateGoldCategory } from '@/api/goldCategories';

interface AddGoldCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a category is created — receives its slug + label. */
  onAdded: (slug: string, label: string) => void;
}

/**
 * Create a new jewellery category (persisted in the database). Shared by the
 * Gold vault landing and the gold asset form's category picker.
 */
export function AddGoldCategoryDialog({ open, onOpenChange, onAdded }: AddGoldCategoryDialogProps) {
  const [name, setName] = useState('');
  const { data: custom = [] } = useGoldCategories();
  const createCategory = useCreateGoldCategory();
  const slug = slugifyCategory(name);
  const taken = new Set(
    [...builtinGoldCategories(), ...custom, { value: 'other', label: 'Other' }].map((c) => c.value),
  );
  const duplicate = !!slug && taken.has(slug);
  const canAdd = !!slug && !duplicate && !createCategory.isPending;

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) setName('');
  };

  const submit = async () => {
    if (!canAdd) return;
    const label = name.trim();
    await createCategory.mutateAsync({ value: slug, label });
    onAdded(slug, label);
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add gold category</DialogTitle>
          <DialogDescription>
            Create a new jewellery category (e.g. Waist chain, Bracelet).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            autoFocus
            value={name}
            placeholder="Category name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          {duplicate && <p className="text-xs text-brand-danger">That category already exists.</p>}
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canAdd}>
            Add category
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
