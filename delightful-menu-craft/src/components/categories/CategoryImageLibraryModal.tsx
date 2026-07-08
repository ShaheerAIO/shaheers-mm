import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { uploadCategoryImage } from '@/lib/categoryImageUpload';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
}

export function CategoryImageLibraryModal({
  open,
  title,
  onOpenChange,
  onSelect,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setUploading(false);
  }, [open]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const permanentUrl = await uploadCategoryImage(file);
      onSelect(permanentUrl);
      onOpenChange(false);
      toast.success('Image uploaded');
    } catch (error) {
      console.log('error ',error)
      toast.error('Image upload failed', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !uploading && onOpenChange(next)}>
      <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-border">
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-xs">Upload a JPG or PNG image.</DialogDescription>
        </DialogHeader>

        <div className="p-5">
          <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center">
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Upload JPG or PNG</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">The file uploads directly to S3. Only its permanent public URL is saved.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="mt-4 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted">
              {file ? 'Choose another file' : 'Choose file'}
            </button>
            {file && <p className="mt-2 text-xs text-muted-foreground">{file.name}</p>}
          </div>
        </div>

        <DialogFooter className="border-t border-border px-5 py-3 flex-row justify-end space-x-2">
          <button type="button" disabled={uploading} onClick={() => onOpenChange(false)} className="rounded-md border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted">Cancel</button>
          <button type="button" disabled={!file || uploading} onClick={() => void handleUpload()} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40">
            {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {uploading ? 'Uploading' : 'Upload and use'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
