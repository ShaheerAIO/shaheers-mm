/**
 * Shared dimensions for POS preview tiles (QSR columns, TSR drill-down, modifier options).
 * Keep these in sync everywhere so buttons look identical.
 * Base sizes were reduced ~20% from 148×160×92.
 */
export const POS_TILE_WIDTH = 'w-[118px] sm:w-[128px] shrink-0';

/** Fixed height for every menu-style tile button */
export const POS_TILE_HEIGHT = 'h-[74px]';

/** Width + height + rounding — use for category, subcategory, item, and modifier option tiles */
export const POS_TILE_FRAME = `${POS_TILE_WIDTH} ${POS_TILE_HEIGHT} rounded-lg box-border`;
