import { useRef, useState, useEffect } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { parseExcelFile } from '@/lib/excelParser';
import { exportToExcel } from '@/lib/excelExporter';
import { DEFAULT_MENU_COLOR } from '@/lib/posColors';
import { toast } from 'sonner';
import { Upload, Download, FilePlus, Plus, Trash2, Pencil, ChevronDown, FolderOpen, LogOut, Check, Loader2, AlertTriangle, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceSession, closeWorkspace, useIsReadOnly, renameWorkspace } from '@/lib/workspaceSync';
import { useAuth } from '@/contexts/AuthContext';
import { Eye } from 'lucide-react';
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

/* AIO appbar control language: 1px rule edge on a surface fill, ink-2 label,
   edge + ink darken on hover. Popovers sit on --shadow-pop. */
const APPBAR_BTN =
  'inline-flex items-center gap-2 h-9 px-3 rounded-[var(--aio-r-2)] border border-rule bg-surface text-[13px] font-medium text-ink-2 transition-colors duration-[200ms] ease-aio hover:border-ink-2 hover:text-ink';
const APPBAR_ICON =
  'inline-flex items-center justify-center h-9 w-9 rounded-[var(--aio-r-2)] border border-rule bg-surface text-ink-muted transition-colors duration-[200ms] ease-aio hover:border-ink-2 hover:text-ink';
const APPBAR_POP =
  'absolute top-full mt-1.5 z-50 rounded-[var(--aio-r-3)] border border-[var(--aio-border)] bg-popover p-1 shadow-pop overflow-hidden';
const APPBAR_POP_ITEM =
  'w-full flex items-center gap-2 px-2.5 py-2 text-[13px] rounded-[var(--aio-r-1)] transition-colors duration-[200ms] ease-aio';

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

  const navigate = useNavigate();
  const { currentId, currentName, status } = useWorkspaceSession();
  const isReadOnly = useIsReadOnly();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleSwitchProject = () => {
    closeWorkspace();
    navigate('/workspaces');
  };

  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [renamingProject, setRenamingProject] = useState(false);
  const renameCancelledRef = useRef(false);

  const startRenameProject = () => {
    setProjectNameDraft(currentName ?? '');
    setIsRenamingProject(true);
  };

  const cancelRenameProject = () => {
    renameCancelledRef.current = true;
    setIsRenamingProject(false);
    setProjectNameDraft('');
  };

  const commitRenameProject = async () => {
    if (renameCancelledRef.current) {
      renameCancelledRef.current = false;
      return;
    }
    const trimmed = projectNameDraft.trim();
    setIsRenamingProject(false);
    if (!currentId || !trimmed || trimmed === currentName) {
      setProjectNameDraft('');
      return;
    }
    setRenamingProject(true);
    try {
      await renameWorkspace(currentId, trimmed);
    } catch (e) {
      toast.error(`Could not rename project: ${(e as Error).message}`);
    } finally {
      setRenamingProject(false);
      setProjectNameDraft('');
    }
  };

  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const [confirmDeleteMenuOpen, setConfirmDeleteMenuOpen] = useState(false);
  const [menuDropdownOpen, setMenuDropdownOpen] = useState(false);
  const [fileDropdownOpen, setFileDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);
  const fileDropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!fileDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!fileDropdownRef.current?.contains(e.target as Node)) {
        setFileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [fileDropdownOpen]);

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
      posButtonColor: DEFAULT_MENU_COLOR,
      picture: '',
      sortOrder,
      visibilityPos: true,
      visibilityKiosk: true,
      visibilityMenuBoard: true,
      visibilityNugget: true,
      visibilityQr: true,
      visibilityWebsite: true,
      visibilityOnline: true,
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
    // stationIds is required by the POS importer for routing — block export if any item lacks one.
    const missingStations = data.items.filter((i) => !i.stationIds.trim());
    if (missingStations.length > 0) {
      const names = missingStations.slice(0, 5).map((i) => i.itemName).join(', ');
      const more = missingStations.length > 5 ? ` and ${missingStations.length - 5} more` : '';
      toast.error('Cannot export: items missing a station', {
        description: `Assign a station to: ${names}${more}.`,
      });
      return;
    }
    const timestamp = new Date().toISOString().split('T')[0];
    exportToExcel(data, `menu-data-${timestamp}.xlsx`);
  };

  return (
    <div
      className="appbar transition-[padding] duration-300"
      style={{ paddingRight: `calc(1rem + ${panelWidth}px)` }}
    >
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Current workspace + save status + switch */}
        {isRenamingProject ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="text"
              value={projectNameDraft}
              disabled={renamingProject}
              onChange={(e) => setProjectNameDraft(e.target.value)}
              onBlur={() => void commitRenameProject()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitRenameProject();
                if (e.key === 'Escape') cancelRenameProject();
              }}
              className="h-9 max-w-[200px] rounded-[var(--aio-r-2)] border border-primary bg-surface px-2.5 text-[13px] font-medium text-ink outline-none shadow-[var(--aio-focus-ring)]"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSwitchProject}
              title="Switch project"
              className={cn(APPBAR_BTN, 'max-w-[200px]')}
            >
              <FolderOpen className="w-4 h-4 shrink-0 text-ink-faint" />
              <span className="truncate">{currentName ?? 'Projects'}</span>
            </button>
            {currentId && !isReadOnly && (
              <button
                type="button"
                onClick={startRenameProject}
                title="Rename project"
                className="flex items-center justify-center h-9 w-9 rounded-[var(--aio-r-2)] text-ink-faint hover:bg-accent hover:text-accent-foreground transition-colors duration-[200ms] ease-aio"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        {isReadOnly ? (
          <span className="aio-chip warn">
            <Eye className="w-3 h-3" /> View only
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-muted w-[70px]">
            {status === 'saving' && (<><Loader2 className="w-3 h-3 animate-spin" /> Saving</>)}
            {status === 'saved' && (<><Check className="w-3 h-3 text-ok" /> Saved</>)}
            {status === 'error' && (<><AlertTriangle className="w-3 h-3 text-danger" /> Error</>)}
            {status === 'conflict' && (<><AlertTriangle className="w-3 h-3 text-warn" /> Conflict</>)}
          </span>
        )}

        <div className="w-px h-5 bg-[var(--aio-rule)]" />

        {/* File Dropdown (New / Import / Export) */}
        <div ref={fileDropdownRef} className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => setFileDropdownOpen((o) => !o)}
            className={cn(APPBAR_BTN, fileDropdownOpen && 'border-primary text-ink')}
          >
            File
            <ChevronDown className={cn('w-4 h-4 text-ink-faint transition-transform duration-[200ms] ease-aio', fileDropdownOpen && 'rotate-180')} />
          </button>

          {fileDropdownOpen && (
            <div className={cn(APPBAR_POP, 'left-0 min-w-[170px]')}>
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => { setFileDropdownOpen(false); handleNewClick(); }}
                className={cn(
                  APPBAR_POP_ITEM,
                  isReadOnly ? 'text-ink-faint cursor-not-allowed' : 'text-ink hover:bg-[var(--aio-hover)]',
                )}
              >
                <FilePlus className="w-4 h-4 text-ink-faint" />
                New
              </button>
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => { setFileDropdownOpen(false); handleImportClick(); }}
                className={cn(
                  APPBAR_POP_ITEM,
                  isReadOnly ? 'text-ink-faint cursor-not-allowed' : 'text-ink hover:bg-[var(--aio-hover)]',
                )}
              >
                <Upload className="w-4 h-4 text-ink-faint" />
                Import
              </button>
              <button
                type="button"
                disabled={!isDataLoaded}
                onClick={() => { setFileDropdownOpen(false); handleExport(); }}
                className={cn(
                  APPBAR_POP_ITEM,
                  isDataLoaded ? 'text-ink hover:bg-[var(--aio-hover)]' : 'text-ink-faint cursor-not-allowed',
                )}
              >
                <Download className="w-4 h-4 text-ink-faint" />
                Export
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-[var(--aio-rule)] mx-1" />

        {/* View Toggle */}
        <div className="flex gap-0.5 rounded-[var(--aio-r-2)] bg-[var(--aio-accent-track)] p-1">
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
          <button
            onClick={() => setViewMode('kiosk-preview')}
            className={cn('toggle-button', viewMode === 'kiosk-preview' && 'active')}
          >
            Kiosk Preview
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
              APPBAR_BTN,
              'min-w-[160px] max-w-[240px]',
              !isDataLoaded && 'bg-surface-2 text-ink-faint cursor-not-allowed hover:border-rule hover:text-ink-faint',
              menuDropdownOpen && 'border-primary text-ink',
            )}
          >
            <span className="flex-1 text-left truncate">
              {selectedMenuId != null
                ? (menus.find((m) => m.id === selectedMenuId)?.menuName ?? 'Select menu')
                : isDataLoaded ? 'Select menu' : 'Import data first'}
            </span>
            <ChevronDown className={cn('w-4 h-4 shrink-0 text-ink-faint transition-transform duration-[200ms] ease-aio', menuDropdownOpen && 'rotate-180')} />
          </button>

          {menuDropdownOpen && isDataLoaded && (
            <div className={cn(APPBAR_POP, 'right-0 min-w-[230px]')}>
              {menus.sort((a, b) => a.sortOrder - b.sortOrder).map((menu) => {
                const isSelected = menu.id === selectedMenuId;
                const isEditing = menu.id === editingMenuId;
                return (
                  <div
                    key={menu.id}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-2 text-[13px] rounded-[var(--aio-r-1)]',
                      isSelected
                        ? 'bg-[var(--aio-accent-soft)] text-[var(--aio-accent-text)] font-medium'
                        : 'text-ink hover:bg-[var(--aio-hover)]',
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
                        'shrink-0 p-1 rounded-[var(--aio-r-1)] transition-colors',
                        isEditing ? 'text-[var(--aio-accent-text)]' : 'text-ink-faint hover:text-ink',
                      )}
                      title="Menu settings"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {menus.length > 1 && !isReadOnly && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedMenu(menu.id); setMenuDropdownOpen(false); setConfirmDeleteMenuOpen(true); }}
                        className="shrink-0 p-1 rounded-[var(--aio-r-1)] text-ink-faint hover:text-danger transition-colors"
                        title="Delete menu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              {!isReadOnly && (
                <div className="mt-1 border-t border-[var(--aio-border)] pt-1">
                  <button
                    type="button"
                    onClick={() => { handleAddMenu(); setMenuDropdownOpen(false); }}
                    className={cn(APPBAR_POP_ITEM, 'text-ink-muted hover:text-ink hover:bg-[var(--aio-hover)]')}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add menu
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          className={APPBAR_ICON}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => void signOut()}
          title="Sign out"
          className={cn(APPBAR_ICON, 'hover:border-danger-edge hover:text-danger')}
        >
          <LogOut className="w-4 h-4" />
        </button>
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
