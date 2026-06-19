import { useState } from 'react';
import { cn } from '@/lib/utils';
import { UtensilsCrossed } from 'lucide-react';
import type { Item } from '@/types/menu';

interface KioskItemCardProps {
  item: Item;
  onClick: () => void;
}

/** Image-forward kiosk item tile: square image, name, price. Light theme. */
export function KioskItemCard({ item, onClick }: KioskItemCardProps) {
  const [imgError, setImgError] = useState(false);
  const isUnavailable = item.stockStatus !== 'inStock';
  const showImage = item.kioskItemImage && !imgError;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isUnavailable}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-black/5 transition-shadow',
        isUnavailable ? 'cursor-not-allowed opacity-50' : 'hover:shadow-md',
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-[#F1F1F1]">
        {showImage ? (
          <img
            src={item.kioskItemImage}
            alt={item.itemName}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#C9C9C9]">
            <UtensilsCrossed className="h-10 w-10" />
          </div>
        )}
        {isUnavailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#242528]">
              Sold out
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
        <span className="line-clamp-2 text-sm font-medium leading-snug text-[#242528]">
          {item.posDisplayName || item.itemName}
        </span>
        <span className="mt-auto text-sm font-semibold tabular-nums text-[#ED7C69]">
          ${item.itemPrice.toFixed(2)}
        </span>
      </div>
    </button>
  );
}
