import { useRef, useState, useEffect } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { parseExcelFile } from '@/lib/excelParser';
import { exportToExcel } from '@/lib/excelExporter';
import { Upload, Download, FilePlus, X, Plus, Trash2, SlidersHorizontal, ChevronDown } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RIGHT_PANEL_WIDTH_PX, CATEGORY_PANEL_WIDTH_PX } from '@/lib/rightPanelWidth';

export function TopBar() {
  const { 
    viewMode, 
    setViewMode, 
    menus, 
    selectedMenuId, 
    setSelectedMenu,
    importData,
    exportData,
    isDataLoaded,
    startFresh,
    addMenu,
    deleteMenu,
    getNextId,
    selectedItemId,
    isCreatingModifier,
    isCreatingOption,
    editingMenuId,
    setEditingMenu,
  } = useMenuStore();

  const panelWidth =
    (selectedItemId ? RIGHT_PANEL_WIDTH_PX : 0) +
    (editingMenuId ? CATEGORY_PANEL_WIDTH_PX : 0) +
    (isCreatingModifier ? RIGHT_PANEL_WIDTH_PX : 0) +
    (isCreatingOption ? RIGHT_PANEL_WIDTH_PX : 0);

  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const [confirmDeleteMenuOpen, setConfirmDeleteMenuOpen] = useState(false);
  const [menuDropdownOpen, setMenuDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuDropdownRef.current?.contains(e.target as Node)) {
        setMenuDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuDropdownOpen]);

  const handleNewClick = () => {
    if (isDataLoaded) {
      setConfirmNewOpen(true);
    } else {
      startFresh();
    }
  };

  const handleAddMenu = () => {
    const id = getNextId('menus');
    const n = menus.length + 1;
    const label = `Menu ${n}`;
    const sortOrder =
      menus.length > 0 ? Math.max(...menus.map((m) => m.sortOrder), 0) + 1 : 1;
    addMenu({
      id,
      menuName: label,
      posDisplayName: label,
      posButtonColor: '#f97316',
      picture: '',
      sortOrder,
      visibilityPos: true,
      visibilityKiosk: true,
      visibilityQr: true,
      visibilityWebsite: true,
      visibilityMobileApp: true,
      visibilityDoordash: true,
      daySchedules: JSON.stringify({ Mon: { enabled: true, start: '', end: '' }, Tue: { enabled: true, start: '', end: '' }, Wed: { enabled: true, start: '', end: '' }, Thu: { enabled: true, start: '', end: '' }, Fri: { enabled: true, start: '', end: '' }, Sat: { enabled: true, start: '', end: '' }, Sun: { enabled: true, start: '', end: '' } }),
    });
    setSelectedMenu(id);
  };

  const handleConfirmDeleteMenu = () => {
    if (selectedMenuId != null) {
      deleteMenu(selectedMenuId);
    }
    setConfirmDeleteMenuOpen(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await parseExcelFile(file);
      importData(data);
      console.log('Successfully imported Excel data');
    } catch (error) {
      console.error('Error importing Excel file:', error);
      alert('Error importing Excel file. Please check the file format.');
    }

    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    const data = exportData();
    const timestamp = new Date().toISOString().split('T')[0];
    exportToExcel(data, `menu-data-${timestamp}.xlsx`);
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b border-panel-border bg-panel-bg transition-[padding] duration-300"
      style={{ paddingRight: `calc(1rem + ${panelWidth}px)` }}
    >
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* New/Import/Export Buttons */}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={handleNewClick}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <FilePlus className="w-4 h-4" />
            New
          </button>
          <button
            onClick={handleImportClick}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={handleExport}
            disabled={!isDataLoaded}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors",
              isDataLoaded 
                ? "border-border hover:bg-accent hover:text-accent-foreground" 
                : "border-border/50 text-muted-foreground cursor-not-allowed"
            )}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        <div className="w-px h-6 bg-border mx-2" />

        {/* View Toggle */}
        <div className="flex rounded-lg bg-muted p-1">
          <button
            onClick={() => setViewMode('tree')}
            className={cn('toggle-button', viewMode === 'tree' && 'active')}
          >
            Tree View
          </button>
          <button
            onClick={() => setViewMode('pos-preview')}
            className={cn('toggle-button', viewMode === 'pos-preview' && 'active')}
          >
            POS Preview
          </button>
        </div>
      </div>

      {/* Menu Selector */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Custom menu dropdown */}
        <div ref={menuDropdownRef} className="relative">
          <button
            type="button"
            disabled={!isDataLoaded}
            onClick={() => setMenuDropdownOpen((o) => !o)}
            className={cn(
              'flex items-center gap-2 h-9 px-3 rounded-md border border-border text-sm transition-colors min-w-[160px] max-w-[240px]',
              isDataLoaded
                ? 'bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
              menuDropdownOpen && 'border-ring ring-1 ring-ring',
            )}
          >
            <span className="flex-1 text-left truncate">
              {selectedMenuId != null
                ? (menus.find((m) => m.id === selectedMenuId)?.menuName ?? 'Select menu')
                : isDataLoaded ? 'Select menu' : 'Import data first'}
            </span>
            <ChevronDown className={cn('w-4 h-4 shrink-0 text-muted-foreground transition-transform', menuDropdownOpen && 'rotate-180')} />
          </button>

          {menuDropdownOpen && isDataLoaded && (
            <div className="absolute top-full mt-1 right-0 z-50 min-w-[220px] bg-popover border border-border rounded-md shadow-lg overflow-hidden">
              {menus.sort((a, b) => a.sortOrder - b.sortOrder).map((menu) => {
                const isSelected = menu.id === selectedMenuId;
                const isEditing = menu.id === editingMenuId;
                return (
                  <div
                    key={menu.id}
                    className={cn(
                      'group flex items-center gap-1 px-3 py-2 text-sm',
                      isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground',
                    )}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left truncate"
                      onClick={() => { setSelectedMenu(menu.id); setMenuDropdownOpen(false); }}
                    >
                      {menu.menuName}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditingMenu(isEditing ? null : menu.id); setMenuDropdownOpen(false); }}
                      className={cn(
                        'shrink-0 p-1 rounded transition-colors',
                        isEditing
                          ? 'text-primary'
                          : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground',
                      )}
                      title="Menu settings"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                    {menus.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedMenu(menu.id); setMenuDropdownOpen(false); setConfirmDeleteMenuOpen(true); }}
                        className="shrink-0 p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-colors"
                        title="Delete menu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              <div className="border-t border-border">
                <button
                  type="button"
                  onClick={() => { handleAddMenu(); setMenuDropdownOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add menu
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete current menu */}
      <AlertDialog open={confirmDeleteMenuOpen} onOpenChange={setConfirmDeleteMenuOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this menu?</AlertDialogTitle>
            <AlertDialogDescription>
              Categories that belong only to this menu will be removed. Categories shared with other
              menus will stay, with this menu unlinked. Items are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteMenu}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete menu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm clear dialog */}
      <AlertDialog open={confirmNewOpen} onOpenChange={setConfirmNewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start fresh?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all menus, categories, items, and modifiers.
              Export first if you want to keep your work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={startFresh}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear &amp; Start Fresh
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
