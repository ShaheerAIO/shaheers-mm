import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import type { Category, Menu } from '@/types/menu';

interface CategoryTreeProps {
  selectedCategoryId: number | null;
  onSelectCategory: (id: number) => void;
}

function parseIds(csv: string | undefined): number[] {
  if (!csv?.trim()) return [];
  return csv.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
}

interface TreeNodeProps {
  category: Category;
  subcategories: Category[];
  allCategories: Category[];
  depth: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function TreeNode({ category, subcategories, allCategories, depth, selectedId, onSelect }: TreeNodeProps) {
  const [open, setOpen] = useState(false);
  const hasChildren = subcategories.length > 0;
  const isSelected = selectedId === category.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onSelect(category.id);
          if (hasChildren) setOpen((o) => !o);
        }}
        className={cn(
          'w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-left transition-colors',
          isSelected
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {hasChildren ? (
          <span className="shrink-0 text-muted-foreground/60">
            {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: category.color || '#71717a' }}
        />
        <span className="truncate flex-1">
          {category.posDisplayName || category.categoryName}
        </span>
      </button>
      {hasChildren && open && (
        <div>
          {subcategories.map((sub) => (
            <TreeNode
              key={sub.id}
              category={sub}
              subcategories={allCategories.filter((c) => c.parentCategoryId === sub.id)}
              allCategories={allCategories}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MenuGroupProps {
  menu: Menu;
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function MenuGroup({ menu, categories, selectedId, onSelect }: MenuGroupProps) {
  const [open, setOpen] = useState(true);
  const rootCats = categories
    .filter((c) => {
      const mIds = parseIds(c.menuIds);
      return mIds.includes(menu.id) && !c.parentCategoryId;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (rootCats.length === 0) return null;

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span className="truncate">{menu.menuName}</span>
      </button>
      {open && (
        <div>
          {rootCats.map((cat) => (
            <TreeNode
              key={cat.id}
              category={cat}
              subcategories={categories.filter((c) => c.parentCategoryId === cat.id)}
              allCategories={categories}
              depth={0}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTree({ selectedCategoryId, onSelectCategory }: CategoryTreeProps) {
  const { menus, categories } = useMenuStore();

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Categories
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {menus.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No menus loaded</p>
        ) : (
          menus
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((menu) => (
              <MenuGroup
                key={menu.id}
                menu={menu}
                categories={categories}
                selectedId={selectedCategoryId}
                onSelect={onSelectCategory}
              />
            ))
        )}
      </div>
    </div>
  );
}
