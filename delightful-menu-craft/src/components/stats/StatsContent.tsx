import { useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { 
  LayoutGrid, 
  FolderOpen, 
  UtensilsCrossed, 
  Settings2, 
  ListChecks,
  AlertTriangle,
  Tag,
  Link2,
  Database,
  ChevronRight,
  ExternalLink,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TabType } from '@/types/menu';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  description?: string;
  color?: string;
  onClick?: () => void;
  clickable?: boolean;
}

interface DrillDownPanelProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function DrillDownPanel({ title, onClose, children }: DrillDownPanelProps) {
  return (
    <div className="bg-card border border-primary/30 rounded-xl p-5 mb-8 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{title}</h3>
        <button 
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>
      {children}
    </div>
  );
}

function StatCard({ title, value, icon, description, color = 'primary', onClick, clickable }: StatCardProps) {
  const colorClasses: Record<string, string> = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    pink: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  };

  return (
    <div 
      className={cn(
        "bg-card border border-border rounded-xl p-5 transition-all",
        clickable && "cursor-pointer hover:shadow-lg hover:border-primary/50 hover:scale-[1.02]"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-bold mt-1">{value.toLocaleString()}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
            {icon}
          </div>
          {clickable && (
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
}

export function StatsContent() {
  const {
    menus,
    categories,
    items,
    modifiers,
    modifierOptions,
    modifierGroups,
    itemModifiers,
    categoryItems,
    allergens,
    tags,
    isDataLoaded,
    setActiveTab,
    navigateToItem,
    navigateToModifier,
  } = useMenuStore();
  
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);

  const goToTab = (tab: TabType) => {
    setActiveTab(tab);
  };

  // Calculate additional stats
  const activeItems = items.filter(item => !item.is86).length;
  const items86 = items.filter(item => item.is86).length;
  const avgItemsPerCategory = categories.length > 0 
    ? Math.round(categoryItems.length / categories.length * 10) / 10 
    : 0;
  const avgModifiersPerItem = items.length > 0 
    ? Math.round(itemModifiers.length / items.length * 10) / 10 
    : 0;
  const avgOptionsPerModifier = modifiers.length > 0
    ? Math.round(modifierOptions.length / modifiers.length * 10) / 10
    : 0;

  // Items with modifiers
  const itemsWithModifiers = new Set(itemModifiers.map(im => im.itemId)).size;
  const itemsWithoutModifiers = items.length - itemsWithModifiers;

  // Price stats
  const itemPrices = items.map(i => i.itemPrice).filter(p => p > 0);
  const avgPrice = itemPrices.length > 0 
    ? (itemPrices.reduce((a, b) => a + b, 0) / itemPrices.length).toFixed(2)
    : '0.00';
  const maxPrice = itemPrices.length > 0 ? Math.max(...itemPrices).toFixed(2) : '0.00';
  const minPrice = itemPrices.length > 0 ? Math.min(...itemPrices).toFixed(2) : '0.00';

  if (!isDataLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center">
          <Database className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground">No Data Loaded</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Import an Excel file to see usage statistics
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Usage Statistics</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your menu data
          </p>
        </div>

        {/* Primary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Menus"
            value={menus.length}
            icon={<LayoutGrid className="w-5 h-5" />}
            color="primary"
            clickable
            onClick={() => goToTab('menu-builder')}
          />
          <StatCard
            title="Categories"
            value={categories.length}
            icon={<FolderOpen className="w-5 h-5" />}
            color="blue"
            clickable
            onClick={() => goToTab('menu-builder')}
          />
          <StatCard
            title="Items"
            value={items.length}
            icon={<UtensilsCrossed className="w-5 h-5" />}
            description={`${activeItems} active, ${items86} 86'd`}
            color="green"
            clickable
            onClick={() => setExpandedPanel(expandedPanel === 'items' ? null : 'items')}
          />
          <StatCard
            title="Modifiers"
            value={modifiers.length}
            icon={<Settings2 className="w-5 h-5" />}
            color="orange"
            clickable
            onClick={() => goToTab('modifier-library')}
          />
        </div>
        
        {/* Items Drill-Down Panel */}
        {expandedPanel === 'items' && (
          <DrillDownPanel
            title="Items Overview"
            onClose={() => setExpandedPanel(null)}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 86'd Items */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  86'd Items ({items86})
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {items.filter(i => i.stockStatus === 'outOfStock').map(item => (
                    <button
                      key={item.id}
                      onClick={() => navigateToItem(item.id)}
                      className="w-full text-left px-3 py-2 text-sm bg-red-500/10 rounded hover:bg-red-500/20 transition-colors flex justify-between"
                    >
                      <span>{item.itemName}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ))}
                  {items86 === 0 && <p className="text-sm text-muted-foreground">No 86'd items</p>}
                </div>
              </div>
              
              {/* Items Without Modifiers */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  Items Without Modifiers ({itemsWithoutModifiers})
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {items.filter(i => !itemModifiers.some(im => im.itemId === i.id)).slice(0, 20).map(item => (
                    <button
                      key={item.id}
                      onClick={() => navigateToItem(item.id)}
                      className="w-full text-left px-3 py-2 text-sm bg-yellow-500/10 rounded hover:bg-yellow-500/20 transition-colors flex justify-between"
                    >
                      <span>{item.itemName}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ))}
                  {itemsWithoutModifiers === 0 && <p className="text-sm text-muted-foreground">All items have modifiers</p>}
                  {itemsWithoutModifiers > 20 && <p className="text-xs text-muted-foreground">...and {itemsWithoutModifiers - 20} more</p>}
                </div>
              </div>
            </div>
          </DrillDownPanel>
        )}

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Modifier Options"
            value={modifierOptions.length}
            icon={<ListChecks className="w-5 h-5" />}
            description={`~${avgOptionsPerModifier} per modifier`}
            color="purple"
            clickable
            onClick={() => setExpandedPanel(expandedPanel === 'modifiers' ? null : 'modifiers')}
          />
          <StatCard
            title="Modifier Groups"
            value={modifierGroups.length}
            icon={<FolderOpen className="w-5 h-5" />}
            color="pink"
            clickable
            onClick={() => goToTab('modifier-library')}
          />
          <StatCard
            title="Allergens"
            value={allergens.length}
            icon={<AlertTriangle className="w-5 h-5" />}
            color="yellow"
          />
          <StatCard
            title="Tags"
            value={tags.length}
            icon={<Tag className="w-5 h-5" />}
            color="cyan"
          />
        </div>
        
        {/* Modifiers Drill-Down Panel */}
        {expandedPanel === 'modifiers' && (
          <DrillDownPanel
            title="Modifiers Overview"
            onClose={() => setExpandedPanel(null)}
          >
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Top Modifiers by Option Count</h4>
              <div className="space-y-2">
                {modifiers
                  .map(m => ({
                    ...m,
                    optionCount: modifierOptions.filter(o => o.parentModifierId === m.id).length
                  }))
                  .sort((a, b) => b.optionCount - a.optionCount)
                  .slice(0, 10)
                  .map(modifier => (
                    <button
                      key={modifier.id}
                      onClick={() => navigateToModifier(modifier.id)}
                      className="w-full text-left px-3 py-2 text-sm bg-muted/50 rounded hover:bg-muted transition-colors flex justify-between items-center"
                    >
                      <span>{modifier.modifierName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{modifier.optionCount} options</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </DrillDownPanel>
        )}

        {/* Relationship Stats */}
        <h2 className="text-lg font-semibold mb-4">Relationships</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard
            title="Category-Item Links"
            value={categoryItems.length}
            icon={<Link2 className="w-5 h-5" />}
            description={`~${avgItemsPerCategory} items per category`}
            color="blue"
            clickable
            onClick={() => setExpandedPanel(expandedPanel === 'categories' ? null : 'categories')}
          />
          <StatCard
            title="Item-Modifier Links"
            value={itemModifiers.length}
            icon={<Link2 className="w-5 h-5" />}
            description={`~${avgModifiersPerItem} modifiers per item`}
            color="green"
            clickable
            onClick={() => goToTab('menu-builder')}
          />
          <StatCard
            title="Items with Modifiers"
            value={itemsWithModifiers}
            icon={<UtensilsCrossed className="w-5 h-5" />}
            description={`${itemsWithoutModifiers} items without modifiers`}
            color="orange"
            clickable
            onClick={() => setExpandedPanel(expandedPanel === 'items' ? null : 'items')}
          />
        </div>
        
        {/* Categories Drill-Down Panel */}
        {expandedPanel === 'categories' && (
          <DrillDownPanel
            title="Categories by Item Count"
            onClose={() => setExpandedPanel(null)}
          >
            <div className="space-y-2">
              {categories
                .map(c => ({
                  ...c,
                  itemCount: categoryItems.filter(ci => ci.categoryId === c.id).length
                }))
                .sort((a, b) => b.itemCount - a.itemCount)
                .map(category => {
                  const maxItems = Math.max(...categories.map(c => 
                    categoryItems.filter(ci => ci.categoryId === c.id).length
                  ), 1);
                  const percentage = (category.itemCount / maxItems) * 100;
                  
                  return (
                    <button
                      key={category.id}
                      onClick={() => goToTab('menu-builder')}
                      className="w-full text-left px-3 py-2 text-sm bg-muted/30 rounded hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span>{category.categoryName}</span>
                        <span className="text-xs text-muted-foreground">{category.itemCount} items</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
            </div>
          </DrillDownPanel>
        )}

        {/* Price Stats */}
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

        {/* Data Summary Table */}
        <h2 className="text-lg font-semibold mb-4">Data Summary</h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-4 text-sm font-semibold">Entity</th>
                <th className="text-right p-4 text-sm font-semibold">Count</th>
                <th className="text-right p-4 text-sm font-semibold">% of Total Records</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Menus', count: menus.length },
                { name: 'Categories', count: categories.length },
                { name: 'Items', count: items.length },
                { name: 'Modifiers', count: modifiers.length },
                { name: 'Modifier Options', count: modifierOptions.length },
                { name: 'Modifier Groups', count: modifierGroups.length },
                { name: 'Category-Item Links', count: categoryItems.length },
                { name: 'Item-Modifier Links', count: itemModifiers.length },
                { name: 'Allergens', count: allergens.length },
                { name: 'Tags', count: tags.length },
              ].map((row, i) => {
                const total = menus.length + categories.length + items.length + 
                  modifiers.length + modifierOptions.length + modifierGroups.length +
                  categoryItems.length + itemModifiers.length + allergens.length + tags.length;
                const percent = total > 0 ? ((row.count / total) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={row.name} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                    <td className="p-4 text-sm">{row.name}</td>
                    <td className="p-4 text-sm text-right font-mono">{row.count.toLocaleString()}</td>
                    <td className="p-4 text-sm text-right font-mono text-muted-foreground">{percent}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

