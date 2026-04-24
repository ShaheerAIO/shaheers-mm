import { useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import {
  LayoutGrid,
  FolderOpen,
  UtensilsCrossed,
  Settings2,
  ListChecks,
  AlertTriangle,
  Database,
  ChevronRight,
  CheckCircle2,
  ImageOff,
  Zap,
  TrendingUp,
  Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { Item } from '@/types/menu';

// ─── Constants ───────────────────────────────────────────────────────────────

const CHANNELS = [
  { key: 'visibilityPos' as keyof Item,       label: 'POS',        color: 'hsl(var(--primary))' },
  { key: 'visibilityKiosk' as keyof Item,     label: 'Kiosk',      color: '#3b82f6' },
  { key: 'visibilityQr' as keyof Item,        label: 'QR',         color: '#8b5cf6' },
  { key: 'visibilityWebsite' as keyof Item,   label: 'Website',    color: '#10b981' },
  { key: 'visibilityMobileApp' as keyof Item, label: 'Mobile App', color: '#f59e0b' },
  { key: 'visibilityDoordash' as keyof Item,  label: 'DoorDash',   color: '#ef4444' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  description?: string;
  color?: string;
}

function StatCard({ title, value, icon, description, color = 'primary' }: StatCardProps) {
  const colorClasses: Record<string, string> = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    blue:    'bg-blue-500/10 text-blue-500 border-blue-500/20',
    green:   'bg-green-500/10 text-green-500 border-green-500/20',
    orange:  'bg-orange-500/10 text-orange-500 border-orange-500/20',
    purple:  'bg-purple-500/10 text-purple-500 border-purple-500/20',
    yellow:  'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  };
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground font-medium truncate">{title}</p>
          <p className="text-3xl font-bold mt-1">{value.toLocaleString()}</p>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        <div className={`p-3 rounded-lg border shrink-0 ml-3 ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  );
}

type Severity = 'red' | 'orange' | 'yellow' | 'blue' | 'slate';

const SEVERITY_STYLES: Record<Severity, { border: string; bg: string; badge: string; icon: string }> = {
  red:    { border: 'border-l-red-500',    bg: 'bg-red-500/5',    badge: 'bg-red-500/15 text-red-500',       icon: 'text-red-500' },
  orange: { border: 'border-l-orange-500', bg: 'bg-orange-500/5', badge: 'bg-orange-500/15 text-orange-500', icon: 'text-orange-500' },
  yellow: { border: 'border-l-yellow-500', bg: 'bg-yellow-500/5', badge: 'bg-yellow-500/15 text-yellow-600', icon: 'text-yellow-600' },
  blue:   { border: 'border-l-blue-500',   bg: 'bg-blue-500/5',   badge: 'bg-blue-500/15 text-blue-500',     icon: 'text-blue-500' },
  slate:  { border: 'border-l-slate-400',  bg: 'bg-muted/40',     badge: 'bg-muted text-muted-foreground',   icon: 'text-muted-foreground' },
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
    <div className={cn('border-l-4 rounded-r-xl overflow-hidden', s.border, s.bg)}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
      >
        <span className={s.icon}>{icon}</span>
        <span className="flex-1 text-sm font-medium">{title}</span>
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full shrink-0', s.badge)}>{count}</span>
        <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', expanded && 'rotate-90')} />
      </button>
      {expanded && <div className="px-4 pb-4 space-y-1">{children}</div>}
    </div>
  );
}

function IssueRow({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1 px-3 rounded-lg bg-background/60 text-sm">
      <span>{label}</span>
      {sub && <span className="text-xs text-muted-foreground ml-4 shrink-0">{sub}</span>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StatsContent() {
  const {
    menus,
    categories,
    items,
    modifiers,
    modifierOptions,
    modifierModifierOptions,
    itemModifiers,
    categoryItems,
    allergens,
    isDataLoaded,
  } = useMenuStore();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Summary numbers ────────────────────────────────────────────────────────

  const active86 = items.filter(i => i.stockStatus === 'outOfStock').length;
  const avgOptionsPerMod = modifiers.length > 0
    ? Math.round((modifierModifierOptions.length / modifiers.length) * 10) / 10
    : 0;

  const itemPrices = items.map(i => i.itemPrice).filter(p => p > 0);
  const avgPrice  = itemPrices.length > 0 ? (itemPrices.reduce((a, b) => a + b, 0) / itemPrices.length).toFixed(2) : '0.00';
  const minPrice  = itemPrices.length > 0 ? Math.min(...itemPrices).toFixed(2) : '0.00';
  const maxPrice  = itemPrices.length > 0 ? Math.max(...itemPrices).toFixed(2) : '0.00';

  // ── Issue: broken modifier configs ────────────────────────────────────────

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

  // ── Issue: 86'd items still live on channels ──────────────────────────────

  const eightysixxedLive = items
    .filter(i => i.stockStatus === 'outOfStock')
    .flatMap(item => {
      const liveOn = CHANNELS.filter(ch => item[ch.key]).map(ch => ch.label);
      return liveOn.length > 0 ? [{ name: item.itemName, liveOn }] : [];
    });

  // ── Issue: dead items (visible on 0 channels) ─────────────────────────────

  const deadItems = items.filter(item => !CHANNELS.some(ch => item[ch.key]));

  // ── Issue: image gaps by channel ──────────────────────────────────────────

  const imageGapGroups = [
    {
      channel: 'DoorDash',
      items: items.filter(i => i.visibilityDoordash && !i.thirdPartyImage),
    },
    {
      channel: 'Kiosk',
      items: items.filter(i => i.visibilityKiosk && !i.kioskItemImage),
    },
    {
      channel: 'Website / Mobile App',
      items: items.filter(i => (i.visibilityWebsite || i.visibilityMobileApp) && !i.onlineImage),
    },
  ].filter(g => g.items.length > 0);

  const totalImageGaps = imageGapGroups.reduce((s, g) => s + g.items.length, 0);

  // ── Issue: price outliers per category ───────────────────────────────────

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
    brokenModifiers.length +
    eightysixxedLive.length +
    deadItems.length +
    totalImageGaps +
    priceOutliers.length;

  // ── Channel coverage ──────────────────────────────────────────────────────

  const channelData = CHANNELS.map(ch => ({
    name: ch.label,
    count: items.filter(i => i[ch.key]).length,
    color: ch.color,
    pct: items.length > 0
      ? Math.round((items.filter(i => i[ch.key]).length / items.length) * 100)
      : 0,
  }));

  // ── No data state ─────────────────────────────────────────────────────────

  if (!isDataLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center">
          <Database className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground">No Data Loaded</h2>
          <p className="text-sm text-muted-foreground mt-2">Import an Excel file to see usage statistics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Usage Statistics</h1>
          <p className="text-muted-foreground mt-1">Overview of your menu data</p>
        </div>

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          <StatCard title="Menus"       value={menus.length}           icon={<LayoutGrid className="w-5 h-5" />}       color="primary" />
          <StatCard title="Categories"  value={categories.length}      icon={<FolderOpen className="w-5 h-5" />}       color="blue" />
          <StatCard title="Items"       value={items.length}           icon={<UtensilsCrossed className="w-5 h-5" />}  color="green"
            description={`${items.length - active86} active, ${active86} 86'd`} />
          <StatCard title="Modifiers"   value={modifiers.length}       icon={<Settings2 className="w-5 h-5" />}        color="orange" />
          <StatCard title="Mod Options" value={modifierOptions.length} icon={<ListChecks className="w-5 h-5" />}       color="purple"
            description={`~${avgOptionsPerMod} per modifier`} />
          <StatCard title="Allergens"   value={allergens.length}       icon={<AlertTriangle className="w-5 h-5" />}    color="yellow" />
        </div>

        {/* Issues section */}
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold">Issues</h2>
          {totalIssues > 0
            ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-500">{totalIssues} found</span>
            : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-600">All clear</span>
          }
        </div>

        {totalIssues === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-green-500/5 border border-green-500/20 rounded-xl mb-10 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            No configuration issues detected.
          </div>
        ) : (
          <div className="space-y-2 mb-10">

            {/* 86'd items still live */}
            <IssueGroup
              icon={<Ban className="w-4 h-4" />}
              title="86'd Items Still Live on Channels"
              count={eightysixxedLive.length}
              severity="red"
              expanded={expanded.has('86live')}
              onToggle={() => toggle('86live')}
            >
              {eightysixxedLive.map((r, i) => (
                <IssueRow key={i} label={r.name} sub={r.liveOn.join(', ')} />
              ))}
            </IssueGroup>

            {/* Broken modifier configs */}
            <IssueGroup
              icon={<Zap className="w-4 h-4" />}
              title="Broken Modifier Configs"
              count={brokenModifiers.length}
              severity="orange"
              expanded={expanded.has('brokenMods')}
              onToggle={() => toggle('brokenMods')}
            >
              {brokenModifiers.map((r, i) => (
                <IssueRow key={i} label={r.name} sub={r.issue} />
              ))}
            </IssueGroup>

            {/* Price outliers */}
            <IssueGroup
              icon={<TrendingUp className="w-4 h-4" />}
              title="Price Outliers Within Categories"
              count={priceOutliers.length}
              severity="yellow"
              expanded={expanded.has('priceOutliers')}
              onToggle={() => toggle('priceOutliers')}
            >
              {priceOutliers.map((r, i) => (
                <IssueRow
                  key={i}
                  label={`${r.itemName}  —  $${r.price.toFixed(2)}`}
                  sub={`${r.direction === 'high' ? '↑' : '↓'} ${(Math.abs(r.price / r.avg - 1) * 100).toFixed(0)}% vs "${r.categoryName}" avg $${r.avg.toFixed(2)}`}
                />
              ))}
            </IssueGroup>

            {/* Image gaps */}
            <IssueGroup
              icon={<ImageOff className="w-4 h-4" />}
              title="Image Gaps by Channel"
              count={totalImageGaps}
              severity="blue"
              expanded={expanded.has('imageGaps')}
              onToggle={() => toggle('imageGaps')}
            >
              {imageGapGroups.map(group => (
                <div key={group.channel} className="pt-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-3">
                    {group.channel} — {group.items.length} item{group.items.length > 1 ? 's' : ''} missing image
                  </p>
                  {group.items.slice(0, 20).map(item => (
                    <IssueRow key={item.id} label={item.itemName} />
                  ))}
                  {group.items.length > 20 && (
                    <p className="text-xs text-muted-foreground px-3 pt-1">
                      …and {group.items.length - 20} more
                    </p>
                  )}
                </div>
              ))}
            </IssueGroup>

            {/* Dead items */}
            <IssueGroup
              icon={<UtensilsCrossed className="w-4 h-4" />}
              title="Items Not Visible on Any Channel"
              count={deadItems.length}
              severity="slate"
              expanded={expanded.has('deadItems')}
              onToggle={() => toggle('deadItems')}
            >
              {deadItems.map(item => (
                <IssueRow key={item.id} label={item.itemName} sub={item.itemPrice > 0 ? `$${item.itemPrice.toFixed(2)}` : undefined} />
              ))}
            </IssueGroup>

          </div>
        )}

        {/* Channel coverage */}
        <h2 className="text-lg font-semibold mb-4">Channel Coverage</h2>
        <div className="bg-card border border-border rounded-xl p-5 mb-10">
          <p className="text-sm text-muted-foreground mb-4">
            Items enabled per channel out of {items.length} total
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={channelData}
                margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                barSize={32}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, items.length]}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, _name: string, entry) => [
                    `${value} items (${entry.payload.pct}%)`,
                    'On channel',
                  ]}
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {channelData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Coverage pills */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-border">
            {channelData.map(ch => (
              <div key={ch.name} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ch.color }} />
                <span className="text-muted-foreground">{ch.name}</span>
                <span className="font-mono font-medium">{ch.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <h2 className="text-lg font-semibold mb-4">Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm text-muted-foreground font-medium">Average Price</p>
            <p className="text-3xl font-bold mt-1">${avgPrice}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm text-muted-foreground font-medium">Lowest Price</p>
            <p className="text-3xl font-bold mt-1 text-green-500">${minPrice}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm text-muted-foreground font-medium">Highest Price</p>
            <p className="text-3xl font-bold mt-1 text-primary">${maxPrice}</p>
          </div>
        </div>

      </div>
    </div>
  );
}
