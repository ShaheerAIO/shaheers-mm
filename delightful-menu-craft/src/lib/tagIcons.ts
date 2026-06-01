import {
  Wine, Beer, BeerOff, Coffee, Milk, GlassWater, Droplets,
  Leaf, Vegan, LeafyGreen, Wheat, WheatOff, MilkOff, Egg, EggOff, Nut, NutOff,
  Flame, Thermometer, ThermometerSun, Snowflake, Sun,
  Beef, Drumstick, Ham, Fish, Shell,
  Cookie, Cake, IceCream, Donut, Croissant,
  Star, ChefHat, Sparkles, Heart, Crown, Gem,
  AlertTriangle, Ban, CircleAlert,
  type LucideIcon,
} from 'lucide-react';

export interface TagIconDef {
  name: string;
  icon: LucideIcon;
  label: string;
  group: string;
}

export const TAG_ICONS: TagIconDef[] = [
  // Beverage
  { name: 'Wine',       icon: Wine,       label: 'Wine / Alcohol',    group: 'Beverage' },
  { name: 'Beer',       icon: Beer,       label: 'Beer',              group: 'Beverage' },
  { name: 'BeerOff',    icon: BeerOff,    label: 'Non-Alcoholic',     group: 'Beverage' },
  { name: 'Coffee',     icon: Coffee,     label: 'Coffee / Espresso', group: 'Beverage' },
  { name: 'Milk',       icon: Milk,       label: 'Milk Drink',        group: 'Beverage' },
  { name: 'GlassWater', icon: GlassWater, label: 'Water',             group: 'Beverage' },
  { name: 'Droplets',   icon: Droplets,   label: 'Juice / Liquid',    group: 'Beverage' },
  // Dietary
  { name: 'Leaf',       icon: Leaf,       label: 'Vegetarian',        group: 'Dietary' },
  { name: 'Vegan',      icon: Vegan,      label: 'Vegan',             group: 'Dietary' },
  { name: 'LeafyGreen', icon: LeafyGreen, label: 'Plant-Based',       group: 'Dietary' },
  { name: 'Wheat',      icon: Wheat,      label: 'Contains Gluten',   group: 'Dietary' },
  { name: 'WheatOff',   icon: WheatOff,   label: 'Gluten-Free',       group: 'Dietary' },
  { name: 'MilkOff',    icon: MilkOff,    label: 'Dairy-Free',        group: 'Dietary' },
  { name: 'Egg',        icon: Egg,        label: 'Contains Egg',      group: 'Dietary' },
  { name: 'EggOff',     icon: EggOff,     label: 'Egg-Free',          group: 'Dietary' },
  { name: 'Nut',        icon: Nut,        label: 'Contains Nuts',     group: 'Dietary' },
  { name: 'NutOff',     icon: NutOff,     label: 'Nut-Free',          group: 'Dietary' },
  // Flavor
  { name: 'Flame',          icon: Flame,          label: 'Spicy / Hot',    group: 'Flavor' },
  { name: 'ThermometerSun', icon: ThermometerSun, label: 'Extra Hot',      group: 'Flavor' },
  { name: 'Thermometer',    icon: Thermometer,    label: 'Mild',           group: 'Flavor' },
  { name: 'Snowflake',      icon: Snowflake,      label: 'Cold / Chilled', group: 'Flavor' },
  { name: 'Sun',            icon: Sun,            label: 'Light / Fresh',  group: 'Flavor' },
  // Protein
  { name: 'Beef',      icon: Beef,      label: 'Beef',      group: 'Protein' },
  { name: 'Drumstick', icon: Drumstick, label: 'Chicken',   group: 'Protein' },
  { name: 'Ham',       icon: Ham,       label: 'Pork',      group: 'Protein' },
  { name: 'Fish',      icon: Fish,      label: 'Fish',      group: 'Protein' },
  { name: 'Shell',     icon: Shell,     label: 'Shellfish', group: 'Protein' },
  // Dessert
  { name: 'Cookie',    icon: Cookie,    label: 'Cookie',          group: 'Dessert' },
  { name: 'Cake',      icon: Cake,      label: 'Cake',            group: 'Dessert' },
  { name: 'IceCream',  icon: IceCream,  label: 'Ice Cream',       group: 'Dessert' },
  { name: 'Donut',     icon: Donut,     label: 'Donut / Pastry',  group: 'Dessert' },
  { name: 'Croissant', icon: Croissant, label: 'Bread / Pastry',  group: 'Dessert' },
  // Special
  { name: 'Star',     icon: Star,     label: 'Signature',      group: 'Special' },
  { name: 'ChefHat',  icon: ChefHat,  label: "Chef's Special", group: 'Special' },
  { name: 'Sparkles', icon: Sparkles, label: 'New / Trending', group: 'Special' },
  { name: 'Heart',    icon: Heart,    label: 'Guest Favorite', group: 'Special' },
  { name: 'Crown',    icon: Crown,    label: 'Premium',        group: 'Special' },
  { name: 'Gem',      icon: Gem,      label: 'Exclusive',      group: 'Special' },
  // Warning
  { name: 'AlertTriangle', icon: AlertTriangle, label: 'Allergen Warning',  group: 'Warning' },
  { name: 'Ban',           icon: Ban,           label: 'Not Available',     group: 'Warning' },
  { name: 'CircleAlert',   icon: CircleAlert,   label: 'Contains Allergen', group: 'Warning' },
];

export const TAG_COLORS: { name: string; value: string }[] = [
  { name: 'Red',    value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber',  value: '#f59e0b' },
  { name: 'Lime',   value: '#84cc16' },
  { name: 'Green',  value: '#22c55e' },
  { name: 'Teal',   value: '#14b8a6' },
  { name: 'Blue',   value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Pink',   value: '#ec4899' },
  { name: 'Rose',   value: '#f43f5e' },
  { name: 'Slate',  value: '#64748b' },
];

export const TAG_ICON_MAP = new Map<string, LucideIcon>(
  TAG_ICONS.map(({ name, icon }) => [name, icon])
);

export function resolveTagIcon(name: string | undefined): LucideIcon | undefined {
  if (!name) return undefined;
  return TAG_ICON_MAP.get(name);
}
