import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type LoadingImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string;
};

export function LoadingImage({ src, className, onLoad, onError, ...props }: LoadingImageProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
  }, [src]);

  return (
    <>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/60" aria-label="Loading image">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        {...props}
        src={src}
        className={cn('transition-opacity duration-200', loading ? 'opacity-0' : 'opacity-100', className)}
        onLoad={(event) => {
          setLoading(false);
          onLoad?.(event);
        }}
        onError={(event) => {
          setLoading(false);
          onError?.(event);
        }}
      />
    </>
  );
}
