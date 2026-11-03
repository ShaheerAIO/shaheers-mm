import { useMemo, useState } from 'react';
import { ChevronRight, Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMenuStore } from '@/store/menuStore';
import { getItemsUsingPreset, resolvePresetOptions } from '@/lib/optionOverrides';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { ModifierPreset } from '@/types/menu';

const inputCls =
  'h-7 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary';

interface Props {
  modifierId: number;
  isNoCharge: boolean;
  isNested: boolean;
}

export function ModifierPresetsSection({ modifierId, isNoCharge, isNested }: Props) {
  const presets = useMenuStore((s) => s.modifierPresets);
  const configs = useMenuStore((s) => s.itemModifierConfigs);
  const items = useMenuStore((s) => s.items);
  const modifierModifierOptions = useMenuStore((s) => s.modifierModifierOptions);
  const modifierOptions = useMenuStore((s) => s.modifierOptions);
  const createModifierPreset = useMenuStore((s) => s.createModifierPreset);
  const updateModifierPreset = useMenuStore((s) => s.updateModifierPreset);
  const setPresetOptionOverride = useMenuStore((s) => s.setPresetOptionOverride);
  const deleteModifierPreset = useMenuStore((s) => s.deleteModifierPreset);
  const duplicateModifierPreset = useMenuStore((s) => s.duplicateModifierPreset);
  const navigateToItem = useMenuStore((s) => s.navigateToItem);

  const mine = useMemo(
    () => presets.filter((p) => p.modifierId === modifierId).sort((a, b) => a.sortOrder - b.sortOrder),
    [presets, modifierId],
  );

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameText, setRenameText] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [usedByOpen, setUsedByOpen] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<ModifierPreset | null>(null);
  const [applying, setApplying] = useState<ModifierPreset | null>(null);

  const resolve = (id: number) =>
    resolvePresetOptions({ modifierModifierOptions, modifierOptions, modifierPresets: presets }, id);

  const submitNew = () => {
    const name = newName.trim();
    if (!name) return;
    const id = createModifierPreset(modifierId, name);
    setNewName('');
    setCreating(false);
    setExpanded(id);
  };

  const commitRename = (p: ModifierPreset) => {
    const name = renameText.trim();
    if (name && name !== p.name) updateModifierPreset(p.id, { name });
    setRenamingId(null);
  };

  const deletingCount = deleting ? getItemsUsingPreset(configs, deleting.id).length : 0;

  return (
    <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Label className="section-header">Presets</Label>
          <p className="text-xs text-muted-foreground">
            Reuse this modifier with a different set of options or prices per item type.
          </p>
        </div>
        {!creating && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New preset
          </Button>
        )}
      </div>

      {creating && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            className={cn(inputCls, 'flex-1')}
            placeholder="Preset name, e.g. Coffee"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
              if (e.key === 'Escape') { setCreating(false); setNewName(''); }
            }}
          />
          <Button type="button" size="sm" disabled={!newName.trim()} onClick={submitNew}>Create</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setCreating(false); setNewName(''); }}>Cancel</Button>
        </div>
      )}

      {mine.length === 0 && !creating && (
        <p className="text-sm text-muted-foreground text-center py-2">No presets yet.</p>
      )}

      <div className="space-y-1.5">
        {mine.map((p) => {
          const resolved = resolve(p.id);
          const visible = resolved.filter((r) => !r.hidden);
          const summary = visible.map((r) => r.option?.optionName ?? '').filter(Boolean).join(' · ');
          const itemIds = getItemsUsingPreset(configs, p.id);
          const isOpen = expanded === p.id;
          return (
            <div key={p.id} className="rounded-md border border-border bg-background">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <button
                  type="button"
                  aria-label={isOpen ? 'Collapse preset' : 'Expand preset'}
                  className="text-muted-foreground"
                  onClick={() => setExpanded(isOpen ? null : p.id)}
                >
                  <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')} />
                </button>
                <div className="min-w-0 flex-1">
                  {renamingId === p.id ? (
                    <input
                      autoFocus
                      className={cn(inputCls, 'w-full')}
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      onBlur={() => commitRename(p)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(p);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-medium hover:underline text-left"
                      title="Click to rename"
                      onClick={() => { setRenamingId(p.id); setRenameText(p.name); }}
                    >
                      {p.name}
                    </button>
                  )}
                  {!isOpen && (
                    <div className="text-xs text-muted-foreground truncate">{summary || 'All options hidden'}</div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={itemIds.length === 0}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground shrink-0"
                  onClick={() => setUsedByOpen(usedByOpen === p.id ? null : p.id)}
                >
                  Used by {itemIds.length} {itemIds.length === 1 ? 'item' : 'items'}
                </button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setApplying(p)}>
                  Apply to items…
                </Button>
                <Button
                  type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Duplicate preset"
                  onClick={() => duplicateModifierPreset(p.id)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Delete preset"
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {usedByOpen === p.id && itemIds.length > 0 && (
                <div className="flex flex-wrap gap-1 px-2 pb-2 pl-8">
                  {itemIds.map((id) => {
                    const it = items.find((i) => i.id === id);
                    return it ? (
                      <button
                        key={id}
                        type="button"
                        className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-muted"
                        onClick={() => navigateToItem(id)}
                      >
                        {it.itemName}
                      </button>
                    ) : null;
                  })}
                </div>
              )}

              {isOpen && (
                <div className="border-t border-border px-2 py-1.5 space-y-1">
                  {resolved.length === 0 && (
                    <p className="text-xs text-muted-foreground py-1">This modifier has no options yet.</p>
                  )}
                  {resolved.map((r) => (
                    <div key={r.mmo.modifierOptionId} className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={r.hidden ? 'Show option' : 'Hide option'}
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setPresetOptionOverride(p.id, r.mmo.modifierOptionId, { hidden: !r.hidden })}
                      >
                        {r.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <span className={cn('flex-1 text-sm truncate', r.hidden && 'text-muted-foreground line-through')}>
                        {r.option?.optionName ?? `Option ${r.mmo.modifierOptionId}`}
                      </span>
                      {!isNoCharge && (
                        <PriceField
                          key={`${p.id}-${r.mmo.modifierOptionId}-${r.priceSource}-${r.price}`}
                          value={r.priceSource === 'preset' ? r.price : null}
                          placeholder={r.basePrice.toFixed(2)}
                          onCommit={(price) =>
                            setPresetOptionOverride(p.id, r.mmo.modifierOptionId, { price })
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog open={deleting !== null} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete preset "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCount > 0
                ? `${deletingCount} ${deletingCount === 1 ? 'item uses' : 'items use'} this preset and will fall back to no preset.`
                : 'No items use this preset.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleting) deleteModifierPreset(deleting.id); setDeleting(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ApplyPresetDialog preset={applying} isNested={isNested} onClose={() => setApplying(null)} />
    </div>
  );
}

function PriceField({
  value, placeholder, onCommit,
}: { value: number | null; placeholder: string; onCommit: (price: number | null) => void }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const commit = () => {
    const t = text.trim();
    if (t === '') { if (value !== null) onCommit(null); return; }
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) { setText(value === null ? '' : String(value)); return; }
    if (n !== value) onCommit(n);
  };
  return (
    <input
      inputMode="decimal"
      className={cn(inputCls, 'w-20 text-right')}
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}

function ApplyPresetDialog({
  preset, isNested, onClose,
}: { preset: ModifierPreset | null; isNested: boolean; onClose: () => void }) {
  const items = useMenuStore((s) => s.items);
  const categories = useMenuStore((s) => s.categories);
  const categoryItems = useMenuStore((s) => s.categoryItems);
  const applyPresetToItems = useMenuStore((s) => s.applyPresetToItems);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const seen = new Set<number>();
    const out: { key: string; name: string; items: typeof items }[] = [];
    const matches = (name: string) => !q || name.toLowerCase().includes(q);
    [...categories].sort((a, b) => a.sortOrder - b.sortOrder).forEach((c) => {
      const ids = categoryItems.filter((ci) => ci.categoryId === c.id).map((ci) => ci.itemId);
      const list = items.filter((i) => ids.includes(i.id) && matches(i.itemName));
      list.forEach((i) => seen.add(i.id));
      if (list.length) out.push({ key: `c${c.id}`, name: c.categoryName, items: list });
    });
    const rest = items.filter((i) => !seen.has(i.id) && matches(i.itemName));
    if (rest.length) out.push({ key: 'none', name: 'Uncategorized', items: rest });
    return out;
  }, [items, categories, categoryItems, search]);

  const close = () => { setSearch(''); setSelected([]); onClose(); };
  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Dialog open={preset !== null} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apply {preset?.name} to items</DialogTitle>
          <DialogDescription>
            {isNested
              ? 'Nested modifier: items must already reach it through a parent.'
              : 'Items without this modifier will have it added.'}
          </DialogDescription>
        </DialogHeader>
        <input
          className={cn(inputCls, 'w-full')}
          placeholder="Search items"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ScrollArea className="h-72 rounded-md border border-border">
          <div className="p-2 space-y-2">
            {groups.length === 0 && <p className="text-sm text-muted-foreground p-2">No items found.</p>}
            {groups.map((g) => (
              <div key={g.key}>
                <div className="text-xs text-muted-foreground px-1 pb-1">{g.name}</div>
                {g.items.map((i) => (
                  <label key={i.id} className="flex items-center gap-2 px-1 py-1 text-sm cursor-pointer rounded hover:bg-muted">
                    <Checkbox checked={selected.includes(i.id)} onCheckedChange={() => toggle(i.id)} />
                    <span className="truncate">{i.itemName}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          <Button
            type="button"
            disabled={selected.length === 0}
            onClick={() => {
              if (preset) {
                applyPresetToItems(preset.id, selected);
                toast.success(`Applied ${preset.name} to ${selected.length} ${selected.length === 1 ? 'item' : 'items'}`);
              }
              close();
            }}
          >
            Apply{selected.length ? ` to ${selected.length}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
