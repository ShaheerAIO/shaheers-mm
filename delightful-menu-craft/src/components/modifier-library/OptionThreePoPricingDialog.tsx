import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { NumberStepperInput } from '@/components/ui/number-stepper-input';
import {
  THREE_PO_PLATFORMS,
  parseThreePoPricing,
  serializeThreePoPricing,
  type ThreePoPlatform,
  type ThreePoPricing,
} from '@/lib/threePoPricing';

type Kind = 'pickup' | 'delivery';
const inputKey = (platform: ThreePoPlatform, kind: Kind) => `${platform}-${kind}`;
// Empty string means "unset" (0).
const fmtPrice = (v: number) => (v ? v.toFixed(2) : '');

function buildInputs(pricing: ThreePoPricing): Record<string, string> {
  const out: Record<string, string> = {};
  THREE_PO_PLATFORMS.forEach(({ key }) => {
    out[inputKey(key, 'pickup')] = fmtPrice(pricing[key].pickupPrice);
    out[inputKey(key, 'delivery')] = fmtPrice(pricing[key].deliveryPrice);
  });
  return out;
}

interface OptionThreePoPricingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  optionName: string;
  /** The option's own surcharge — what each platform inherits by default. */
  basePrice: number;
  /** Serialized ThreePoPricing currently stored on the option. */
  pricing: string | undefined;
  onSave: (pricing: string) => void;
}

/**
 * Per-platform third-party (3PO) pricing for a single modifier option. The POS
 * keeps one 3PO row per platform per option row, so these prices are global to
 * the option — every modifier that uses it sees the same overrides.
 */
export function OptionThreePoPricingDialog({
  isOpen,
  onClose,
  optionName,
  basePrice,
  pricing,
  onSave,
}: OptionThreePoPricingDialogProps) {
  const [draft, setDraft] = useState<ThreePoPricing>(() => parseThreePoPricing(pricing));
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    buildInputs(parseThreePoPricing(pricing)),
  );

  // Re-seed whenever the dialog opens on a (possibly different) option.
  useEffect(() => {
    if (!isOpen) return;
    const parsed = parseThreePoPricing(pricing);
    setDraft(parsed);
    setInputs(buildInputs(parsed));
  }, [isOpen, pricing]);

  const handlePriceChange = (platform: ThreePoPlatform, kind: Kind, value: string) => {
    setInputs((prev) => ({ ...prev, [inputKey(platform, kind)]: value }));
    const trimmed = value.trim();
    const price = trimmed === '' ? 0 : parseFloat(trimmed);
    if (isNaN(price) || price < 0) return;
    setDraft((d) => ({
      ...d,
      [platform]: {
        ...d[platform],
        [kind === 'pickup' ? 'pickupPrice' : 'deliveryPrice']: price,
      },
    }));
  };

  const handleInheritToggle = (platform: ThreePoPlatform, inherit: boolean) => {
    setDraft((d) => ({ ...d, [platform]: { ...d[platform], inherit } }));
  };

  const handleSave = () => {
    onSave(serializeThreePoPricing(draft));
    onClose();
  };

  const basePlaceholder = basePrice > 0 ? basePrice.toFixed(2) : '0.00';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Third-party pricing</DialogTitle>
          <DialogDescription>
            Set independent Pickup and Delivery prices for “{optionName}” per platform, or
            inherit its price{basePrice > 0 ? ` ($${basePrice.toFixed(2)})` : ''}. These prices
            belong to the option, so every modifier that uses it shares them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {THREE_PO_PLATFORMS.map(({ key, label }) => {
            const platform = draft[key];
            return (
              <div key={key} className="rounded-md border border-border bg-muted/20 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Inherit</span>
                    <Switch
                      checked={platform.inherit}
                      onCheckedChange={(checked) => handleInheritToggle(key, checked)}
                      aria-label={`Inherit ${label} pricing`}
                    />
                  </div>
                </div>
                {platform.inherit ? (
                  <p className="text-[10px] text-muted-foreground">
                    Inherits pricing from third-party orders (no adjustment).
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {(['pickup', 'delivery'] as Kind[]).map((kind) => {
                      const value = inputs[inputKey(key, kind)] ?? '';
                      return (
                        <div key={kind} className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground capitalize">{kind}</Label>
                          <NumberStepperInput
                            inputMode="decimal"
                            placeholder={basePlaceholder}
                            value={value}
                            onChange={(e) => handlePriceChange(key, kind, e.target.value)}
                            onStep={(delta) =>
                              handlePriceChange(
                                key,
                                kind,
                                Math.max(0, (parseFloat(value) || 0) + delta).toFixed(2),
                              )
                            }
                            prefix={<span className="text-muted-foreground">$</span>}
                            wrapperClassName="w-full"
                            aria-label={`${label} ${kind} price`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
