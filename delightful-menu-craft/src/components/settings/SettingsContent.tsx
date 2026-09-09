import { useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import {
  Percent,
  Database,
  ChevronRight,
  CheckCircle2,
  ImageOff,
  Zap,
  TrendingUp,
  Ban,
  UtensilsCrossed,
  Receipt,
  Tags,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Item } from '@/types/menu';

// ─── Channels (for coverage + issue checks) ──────────────────────────────────

const CHANNELS = [
  { key: 'visibilityPos' as keyof Item,       label: 'POS' },
  { key: 'visibilityKiosk' as keyof Item,     label: 'Kiosk' },
  { key: 'visibilityMenuBoard' as keyof Item, label: 'Menu Board' },
  { key: 'visibilityQr' as keyof Item,        label: 'QR' },
  { key: 'visibilityWebsite' as keyof Item,   label: 'Website' },
  { key: 'visibilityMobileApp' as keyof Item, label: 'MPOS' },
  { key: 'visibilityDoordash' as keyof Item,  label: 'DoorDash' },
];

// ─── Compact issue list (carried over from the old Stats view) ───────────────

type Severity = 'red' | 'orange' | 'yellow' | 'blue' | 'slate';

const SEVERITY_STYLES: Record<Severity, { border: string; bg: string; badge: string; icon: string }> = {
  red:    { border: 'border-l-danger',    bg: 'bg-danger-bg',    badge: 'bg-danger-bg text-danger',       icon: 'text-danger' },
  orange: { border: 'border-l-primary', bg: 'bg-[var(--aio-accent-soft)]', badge: 'bg-[var(--aio-accent-soft)] text-[var(--aio-accent-text)]', icon: 'text-[var(--aio-accent-text)]' },
  yellow: { border: 'border-l-warn', bg: 'bg-warn-bg', badge: 'bg-warn-bg text-warn', icon: 'text-warn' },
  blue:   { border: 'border-l-[var(--aio-info)]',   bg: 'bg-[var(--aio-info-bg)]',   badge: 'bg-[var(--aio-info-bg)] text-[var(--aio-info)]',     icon: 'text-[var(--aio-info)]' },
  slate:  { border: 'border-l-rule-2',  bg: 'bg-muted/40',     badge: 'bg-muted text-muted-foreground',   icon: 'text-muted-foreground' },
};

interface IssueGroupProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  severity: Severity;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function IssueGroup({ icon, title, count, severity, expanded, onToggle, children }: IssueGroupProps) {
  if (count === 0) return null;
  const s = SEVERITY_STYLES[severity];
  return (
    <div className={cn('border-l-4 rounded-r-lg overflow-hidden', s.border, s.bg)}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
      >
        <span className={s.icon}>{icon}</span>
        <span className="flex-1 text-sm font-medium">{title}</span>
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full shrink-0', s.badge)}>{count}</span>
        <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', expanded && 'rotate-90')} />
      </button>
      {expanded && <div className="px-3 pb-3 space-y-1">{children}</div>}
    </div>
  );
}

function IssueRow({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1 px-3 rounded-md bg-background/60 text-sm">
      <span>{label}</span>
      {sub && <span className="text-xs text-muted-foreground ml-4 shrink-0">{sub}</span>}
    </div>
  );
}

/** Distinct placeholder name so clicking Add twice creates two rows, not one. */
const nextUntitledSalesCategory = (existing: readonly { name: string }[]): string => {
  const base = 'New sales category';
  const taken = new Set(existing.map(c => c.name.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
};

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsContent() {
  const {
    menus,
    categories,
    items,
    modifiers,
    modifierOptions,
    modifierModifierOptions,
    categoryItems,
    allergens,
    isDataLoaded,
    taxRate,
    setTaxRate,
    customTaxes,
    addCustomTax,
    updateCustomTax,
    deleteCustomTax,
    salesCategories,
    addSalesCategory,
    updateSalesCategory,
    deleteSalesCategory,
    getNextId,
  } = useMenuStore();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Counts ──────────────────────────────────────────────────────────────────
  const active86 = items.filter(i => i.stockStatus === 'outOfStock').length;
  const itemPrices = items.map(i => i.itemPrice).filter(p => p > 0);
  const avgPrice = itemPrices.length > 0 ? (itemPrices.reduce((a, b) => a + b, 0) / itemPrices.length).toFixed(2) : '0.00';
  const minPrice = itemPrices.length > 0 ? Math.min(...itemPrices).toFixed(2) : '0.00';
  const maxPrice = itemPrices.length > 0 ? Math.max(...itemPrices).toFixed(2) : '0.00';

  // ── Issues ────────────────────────────────────────────────────────────────────
  const brokenModifiers = modifiers.flatMap(m => {
    const optCount = modifierModifierOptions.filter(mmo => mmo.modifierId === m.id).length;
    const issues: string[] = [];
    if (optCount === 0 && m.minSelector > 0) {
      issues.push(`Requires ${m.minSelector} selection${m.minSelector > 1 ? 's' : ''} but has no options`);
    } else if (m.minSelector > optCount) {
      issues.push(`Requires ${m.minSelector} selection${m.minSelector > 1 ? 's' : ''}, only ${optCount} option${optCount === 1 ? '' : 's'} exist`);
    }
    if (!m.noMaxSelection && m.maxSelector > 0 && m.minSelector > m.maxSelector) {
      issues.push(`Min (${m.minSelector}) exceeds max (${m.maxSelector})`);
    }
    return issues.map(issue => ({ name: m.modifierName, issue }));
  });

  const eightysixxedLive = items
    .filter(i => i.stockStatus === 'outOfStock')
    .flatMap(item => {
      const liveOn = CHANNELS.filter(ch => item[ch.key]).map(ch => ch.label);
      return liveOn.length > 0 ? [{ name: item.itemName, liveOn }] : [];
    });

  const deadItems = items.filter(item => !CHANNELS.some(ch => item[ch.key]));

  const imageGapGroups = [
    { channel: 'DoorDash', items: items.filter(i => i.visibilityDoordash && !i.thirdPartyImage) },
    { channel: 'Kiosk', items: items.filter(i => i.visibilityKiosk && !i.kioskItemImage) },
    { channel: 'Website / MPOS', items: items.filter(i => (i.visibilityWebsite || i.visibilityMobileApp) && !i.onlineImage) },
  ].filter(g => g.items.length > 0);
  const totalImageGaps = imageGapGroups.reduce((s, g) => s + g.items.length, 0);

  const priceOutliers = categories.flatMap(cat => {
    const catItems = categoryItems
      .filter(ci => ci.categoryId === cat.id)
      .map(ci => items.find(i => i.id === ci.itemId))
      .filter((i): i is Item => i !== undefined && i.itemPrice > 0);
    if (catItems.length < 3) return [];
    const avg = catItems.reduce((s, i) => s + i.itemPrice, 0) / catItems.length;
    return catItems
      .filter(i => i.itemPrice > avg * 2.5 || i.itemPrice < avg * 0.3)
      .map(item => ({
        itemName: item.itemName,
        price: item.itemPrice,
        categoryName: cat.categoryName,
        avg,
        direction: item.itemPrice > avg ? 'high' : 'low',
      }));
  });

  const totalIssues =
    brokenModifiers.length + eightysixxedLive.length + deadItems.length + totalImageGaps + priceOutliers.length;

  // ── Channel coverage ──────────────────────────────────────────────────────────
  const channelData = CHANNELS.map(ch => ({
    name: ch.label,
    pct: items.length > 0 ? Math.round((items.filter(i => i[ch.key]).length / items.length) * 100) : 0,
  }));

  const counts = [
    { label: 'Menus', value: menus.length },
    { label: 'Categories', value: categories.length },
    { label: 'Items', value: items.length, note: `${items.length - active86} active · ${active86} 86'd` },
    { label: 'Modifiers', value: modifiers.length },
    { label: 'Options', value: modifierOptions.length },
    { label: 'Allergens', value: allergens.length },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Restaurant-level configuration</p>
        </div>

        {/* ── Tax (primary) ──────────────────────────────────────────────────── */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Percent className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Sales tax</h2>
              <p className="text-xs text-muted-foreground">Applied to item price plus modifier-option surcharges</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="tax-rate" className="text-sm font-medium">Tax rate</label>
            <div className="relative">
              <input
                id="tax-rate"
                type="number"
                min={0}
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
                className="input-field w-28 text-sm pr-7 text-right"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
            </div>
          </div>
        </section>

        {/* ── Custom taxes ───────────────────────────────────────────────────── */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Custom taxes</h2>
              <p className="text-xs text-muted-foreground">Named rates that override the standard rate on assigned items</p>
            </div>
          </div>

          <div className="space-y-2">
            {customTaxes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No custom taxes yet. Add one to override the standard rate on specific items.</p>
            ) : (
              customTaxes.map(tax => (
                <div key={tax.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tax.name}
                    placeholder="Tax name"
                    onChange={(e) => updateCustomTax(tax.id, { name: e.target.value })}
                    className="input-field flex-1 text-sm"
                  />
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={tax.rate}
                      onChange={(e) => updateCustomTax(tax.id, { rate: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="input-field w-28 text-sm pr-7 text-right"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
                  </div>
                  <button
                    onClick={() => deleteCustomTax(tax.id)}
                    aria-label="Delete tax"
                    className="p-2 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger-bg transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
            <button
              onClick={() => addCustomTax({ id: getNextId('customTaxes'), name: '', rate: 0 })}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline pt-1"
            >
              <Plus className="w-4 h-4" />
              Add tax
            </button>
          </div>
        </section>

        {/* ── Sales categories ───────────────────────────────────────────────── */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Tags className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Sales categories</h2>
              <p className="text-xs text-muted-foreground">Revenue buckets items report into. The POS defaults are fixed; custom ones are yours to edit</p>
            </div>
          </div>

          <div className="space-y-2">
            {salesCategories.map(sc => (
              <div key={sc.id} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground text-right">{sc.id}</span>
                {sc.isDefault ? (
                  <span className="flex-1 text-sm px-3 py-2 rounded-lg bg-muted/40 text-muted-foreground">{sc.name}</span>
                ) : (
                  <input
                    type="text"
                    value={sc.name}
                    placeholder="Sales category name"
                    onChange={(e) => updateSalesCategory(sc.id, { name: e.target.value })}
                    className={cn('input-field flex-1 text-sm', !sc.name.trim() && 'border-destructive')}
                  />
                )}
                <button
                  onClick={() => deleteSalesCategory(sc.id)}
                  disabled={sc.isDefault}
                  aria-label={sc.isDefault ? 'POS default — cannot be deleted' : `Delete ${sc.name}`}
                  title={sc.isDefault ? 'POS default — cannot be deleted' : undefined}
                  className="p-2 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger-bg disabled:opacity-30 disabled:hover:text-muted-foreground disabled:hover:bg-transparent transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-1">
              Deleting a custom category moves its items to Food Sales.
              {salesCategories.some(sc => !sc.isDefault && !sc.name.trim()) && (
                <span className="text-destructive"> Unnamed categories export as Food Sales.</span>
              )}
            </p>
            <button
              onClick={() => addSalesCategory(nextUntitledSalesCategory(salesCategories))}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline pt-1"
            >
              <Plus className="w-4 h-4" />
              Add sales category
            </button>
          </div>
        </section>

        {/* ── Menu health (secondary, compact) ───────────────────────────────── */}
        {!isDataLoaded ? (
          <section className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/30 border border-border rounded-xl px-4 py-3">
            <Database className="w-4 h-4 shrink-0" />
            Import an Excel file to see menu health.
          </section>
        ) : (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Menu health</h2>
              {totalIssues > 0
                ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-danger-bg text-danger">{totalIssues} issues</span>
                : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-ok-bg text-ok">All clear</span>}
            </div>

            {/* Inline counts */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm border border-border rounded-lg px-4 py-3 bg-card">
              {counts.map(c => (
                <span key={c.label} className="flex items-baseline gap-1.5">
                  <span className="font-semibold tabular-nums">{c.value}</span>
                  <span className="text-muted-foreground">{c.label}</span>
                  {c.note && <span className="text-xs text-muted-foreground">({c.note})</span>}
                </span>
              ))}
            </div>

            {/* Issues */}
            {totalIssues === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-ok-bg border border-ok-edge rounded-lg text-sm text-ok">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                No configuration issues detected.
              </div>
            ) : (
              <div className="space-y-2">
                <IssueGroup icon={<Ban className="w-4 h-4" />} title="86'd items still live on channels" count={eightysixxedLive.length} severity="red" expanded={expanded.has('86live')} onToggle={() => toggle('86live')}>
                  {eightysixxedLive.map((r, i) => <IssueRow key={i} label={r.name} sub={r.liveOn.join(', ')} />)}
                </IssueGroup>
                <IssueGroup icon={<Zap className="w-4 h-4" />} title="Broken modifier configs" count={brokenModifiers.length} severity="orange" expanded={expanded.has('brokenMods')} onToggle={() => toggle('brokenMods')}>
                  {brokenModifiers.map((r, i) => <IssueRow key={i} label={r.name} sub={r.issue} />)}
                </IssueGroup>
                <IssueGroup icon={<TrendingUp className="w-4 h-4" />} title="Price outliers within categories" count={priceOutliers.length} severity="yellow" expanded={expanded.has('priceOutliers')} onToggle={() => toggle('priceOutliers')}>
                  {priceOutliers.map((r, i) => (
                    <IssueRow key={i} label={`${r.itemName}  —  $${r.price.toFixed(2)}`} sub={`${r.direction === 'high' ? '↑' : '↓'} ${(Math.abs(r.price / r.avg - 1) * 100).toFixed(0)}% vs "${r.categoryName}" avg $${r.avg.toFixed(2)}`} />
                  ))}
                </IssueGroup>
                <IssueGroup icon={<ImageOff className="w-4 h-4" />} title="Image gaps by channel" count={totalImageGaps} severity="blue" expanded={expanded.has('imageGaps')} onToggle={() => toggle('imageGaps')}>
                  {imageGapGroups.map(group => (
                    <div key={group.channel} className="pt-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-3">
                        {group.channel} — {group.items.length} missing
                      </p>
                      {group.items.slice(0, 20).map(item => <IssueRow key={item.id} label={item.itemName} />)}
                      {group.items.length > 20 && <p className="text-xs text-muted-foreground px-3 pt-1">…and {group.items.length - 20} more</p>}
                    </div>
                  ))}
                </IssueGroup>
                <IssueGroup icon={<UtensilsCrossed className="w-4 h-4" />} title="Items not visible on any channel" count={deadItems.length} severity="slate" expanded={expanded.has('deadItems')} onToggle={() => toggle('deadItems')}>
                  {deadItems.map(item => <IssueRow key={item.id} label={item.itemName} sub={item.itemPrice > 0 ? `$${item.itemPrice.toFixed(2)}` : undefined} />)}
                </IssueGroup>
              </div>
            )}

            {/* Channel coverage + pricing — thin one-liners */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm border-t border-border pt-3">
              <span className="text-muted-foreground font-medium">Coverage:</span>
              {channelData.map(ch => (
                <span key={ch.name} className="flex items-baseline gap-1">
                  <span className="text-muted-foreground">{ch.name}</span>
                  <span className="font-mono font-medium">{ch.pct}%</span>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 text-sm">
              <span className="text-muted-foreground font-medium">Pricing:</span>
              <span>avg <span className="font-medium">${avgPrice}</span></span>
              <span>low <span className="font-medium text-ok">${minPrice}</span></span>
              <span>high <span className="font-medium text-primary">${maxPrice}</span></span>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
