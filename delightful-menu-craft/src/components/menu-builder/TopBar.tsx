import { useRef, useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { parseExcelFile } from '@/lib/excelParser';
import { exportToExcel } from '@/lib/excelExporter';
import { Upload, Download, FilePlus, Sparkles, Pencil, Check, X, Plus, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { AiEnhanceModal } from './AiEnhanceModal';

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
    updateMenu,
    addMenu,
    deleteMenu,
    getNextId,
  } = useMenuStore();

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const [confirmDeleteMenuOpen, setConfirmDeleteMenuOpen] = useState(false);
  const [renamingMenu, setRenamingMenu] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const handleNewClick = () => {
    if (isDataLoaded) {
      setConfirmNewOpen(true);
    } else {
      startFresh();
    }
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && selectedMenuId != null) {
      updateMenu(selectedMenuId, { menuName: trimmed, posDisplayName: trimmed });
    }
    setRenamingMenu(false);
  };

  const startRename = () => {
    const current = menus.find((m) => m.id === selectedMenuId);
    setRenameValue(current?.menuName ?? '');
    setRenamingMenu(true);
    setTimeout(() => renameInputRef.current?.select(), 0);
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
    <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border bg-panel-bg">
      <div className="flex items-center gap-3">
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

          {/* AI Enhance */}
          <button
            onClick={() => setAiModalOpen(true)}
            disabled={!isDataLoaded}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors",
              isDataLoaded
                ? "border-orange-500/60 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400"
                : "border-border/50 text-muted-foreground cursor-not-allowed"
            )}
            title="Enhance menu with AI: suggest stations, short names, and descriptions"
          >
            <Sparkles className="w-4 h-4" />
            AI Enhance
          </button>
        </div>

        <AiEnhanceModal open={aiModalOpen} onOpenChange={setAiModalOpen} />

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
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Menu:</span>

        {renamingMenu ? (
          <div className="flex items-center gap-1">
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenamingMenu(false);
              }}
              className="w-40 px-2 py-1 text-sm rounded-md border border-ring bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); commitRename(); }}
              className="p-1 text-emerald-400 hover:text-emerald-300"
              title="Save"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); setRenamingMenu(false); }}
              className="p-1 text-zinc-500 hover:text-zinc-300"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <Select
              value={selectedMenuId?.toString() || ''}
              onValueChange={(val) => setSelectedMenu(val ? parseInt(val) : null)}
              disabled={!isDataLoaded}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder={isDataLoaded ? "Select menu" : "Import data first"} />
              </SelectTrigger>
              <SelectContent>
                {menus.map((menu) => (
                  <SelectItem key={menu.id} value={menu.id.toString()}>
                    {menu.menuName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={handleAddMenu}
              className="flex items-center gap-1 px-2 py-1.5 rounded-md text-sm font-medium border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Add another menu"
            >
              <Plus className="w-4 h-4" />
              Add menu
            </button>

            {selectedMenuId != null && isDataLoaded && (
              <button
                type="button"
                onClick={startRename}
                className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                title="Rename menu"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}

            {selectedMenuId != null && isDataLoaded && menus.length > 1 && (
              <button
                type="button"
                onClick={() => setConfirmDeleteMenuOpen(true)}
                className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-white/5 transition-colors"
                title="Delete this menu"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
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
