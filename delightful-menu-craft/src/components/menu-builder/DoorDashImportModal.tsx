import { useState, useRef } from 'react';
import { Upload, Link, Loader2, CheckCircle2, AlertCircle, Store } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { scrapeByUrl, normalizeRawPayload, isValidDoorDashUrl } from '@/lib/doordashApi';
import {
  mapScraperToExcelData,
  buildImportSummary,
  parseJsonFile,
  type ScraperImportSummary,
} from '@/lib/doorDashMapper';
import type { ScraperMenuData } from '@/lib/doordashApi';
import type { ExcelMenuData } from '@/types/menu';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'input' | 'loading' | 'preview' | 'error';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: ExcelMenuData) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DoorDashImportModal({ open, onOpenChange, onImport }: Props) {
  const [tab, setTab] = useState<'url' | 'json'>('url');
  const [step, setStep] = useState<Step>('input');
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingData, setPendingData] = useState<ScraperMenuData | null>(null);
  const [summary, setSummary] = useState<ScraperImportSummary | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // --- Helpers ---

  function reset() {
    setStep('input');
    setUrlInput('');
    setUrlError('');
    setErrorMessage('');
    setPendingData(null);
    setSummary(null);
    setDragActive(false);
  }

  function handleClose(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  function handleScrapeResult(data: ScraperMenuData) {
    setPendingData(data);
    setSummary(buildImportSummary(data));
    setStep('preview');
  }

  function handleError(err: unknown) {
    setErrorMessage(err instanceof Error ? err.message : String(err));
    setStep('error');
  }

  function confirmImport() {
    if (!pendingData) return;
    onImport(mapScraperToExcelData(pendingData));
    onOpenChange(false);
    reset();
  }

  // --- URL tab ---

  function handleUrlChange(value: string) {
    setUrlInput(value);
    if (urlError) setUrlError('');
  }

  async function handleScrapeUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setUrlError('Please enter a DoorDash store URL.');
      return;
    }
    if (!isValidDoorDashUrl(trimmed)) {
      setUrlError('URL must be a doordash.com/store/ link.');
      return;
    }
    setStep('loading');
    try {
      const data = await scrapeByUrl(trimmed);
      handleScrapeResult(data);
    } catch (err) {
      handleError(err);
    }
  }

  function handleUrlKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleScrapeUrl();
  }

  // --- JSON tab ---

  async function processJsonFile(file: File) {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      handleError(new Error('Please upload a .json file.'));
      return;
    }
    setStep('loading');
    try {
      const raw = await parseJsonFile(file);

      // If it looks like a raw scrape_store() payload, normalize via backend
      const isRawPayload =
        'source' in raw && ('item_lists' in raw || 'sections' in raw);

      const data: ScraperMenuData = isRawPayload
        ? await normalizeRawPayload(raw)
        : raw;

      handleScrapeResult(data);
    } catch (err) {
      handleError(err);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processJsonFile(file);
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processJsonFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave() {
    setDragActive(false);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-orange-500" />
            Import from DoorDash
          </DialogTitle>
        </DialogHeader>

        {/* Input step */}
        {step === 'input' && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'url' | 'json')}>
            <TabsList className="w-full">
              <TabsTrigger value="url" className="flex-1 flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5" />
                DoorDash URL
              </TabsTrigger>
              <TabsTrigger value="json" className="flex-1 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Upload JSON
              </TabsTrigger>
            </TabsList>

            {/* URL tab */}
            <TabsContent value="url" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Paste a DoorDash store link. The scraper will extract the menu automatically.
              </p>
              <div className="space-y-1.5">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onKeyDown={handleUrlKeyDown}
                  placeholder="https://www.doordash.com/store/..."
                  className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  autoFocus
                />
                {urlError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {urlError}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => handleClose(false)}
                  className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScrapeUrl}
                  className="px-3 py-1.5 text-sm font-medium rounded-md bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                >
                  Scrape & Import
                </button>
              </div>
            </TabsContent>

            {/* JSON tab */}
            <TabsContent value="json" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload the JSON output from the DoorDash scraper.
              </p>
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => jsonInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && jsonInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`flex flex-col items-center justify-center gap-2 py-8 px-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-orange-500 bg-orange-500/5'
                    : 'border-border hover:border-orange-400 hover:bg-accent/50'
                }`}
              >
                <Upload className="w-6 h-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  <span className="font-medium text-foreground">Click to upload</span> or drag &
                  drop
                </p>
                <p className="text-xs text-muted-foreground">JSON file from scraper output</p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => handleClose(false)}
                  className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Loading step */}
        {step === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-sm font-medium">
              {tab === 'url' ? 'Scraping DoorDash menu…' : 'Processing JSON…'}
            </p>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              {tab === 'url'
                ? 'This may take up to 30 seconds while the page loads.'
                : 'Normalizing your data…'}
            </p>
          </div>
        )}

        {/* Preview / confirmation step */}
        {step === 'preview' && summary && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <CheckCircle2 className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{summary.storeName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {summary.categoryCount} categories &middot; {summary.itemCount} items
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              This will create a new menu draft. Your existing menus will not be affected.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setStep('input')}
                className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Back
              </button>
              <button
                onClick={confirmImport}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              >
                Import Menu
              </button>
            </div>
          </div>
        )}

        {/* Error step */}
        {step === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Import failed</p>
                <p className="text-xs text-muted-foreground mt-1 break-words">{errorMessage}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => handleClose(false)}
                className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => setStep('input')}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
