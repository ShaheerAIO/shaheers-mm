import { useRef } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { parseExcelFile } from '@/lib/excelParser';
import { exportToExcel } from '@/lib/excelExporter';
import { Upload, Download, FilePlus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  } = useMenuStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

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
            onClick={startFresh}
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
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Menu:</span>
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
      </div>
    </div>
  );
}
