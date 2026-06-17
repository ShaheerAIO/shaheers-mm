import { supabase } from '@/lib/supabase';
import type { Item, Category, CategoryItem, AiEnhanceResult } from '@/types/menu';

const MODEL = 'claude-haiku-4-5';

interface MenuContext {
  items: Item[];
  categories: Category[];
  categoryItems: CategoryItem[];
  stations: string[];
}

interface CompactItem {
  id: number;
  name: string;
  posName: string;
  desc: string;
  station: string;
  category: string;
}

interface CompactPayload {
  categories: Array<{ id: number; name: string }>;
  items: CompactItem[];
  currentStations: string[];
}

function buildPayload(ctx: MenuContext): CompactPayload {
  const catMap = new Map(ctx.categories.map((c) => [c.id, c.categoryName]));

  return {
    categories: ctx.categories.map((c) => ({ id: c.id, name: c.categoryName })),
    items: ctx.items.map((i) => {
      const catId = ctx.categoryItems.find((ci) => ci.itemId === i.id)?.categoryId;
      return {
        id: i.id,
        name: i.itemName,
        posName: i.posDisplayName || '',
        desc: i.itemDescription || '',
        station: i.stationIds || '',
        category: catId != null ? (catMap.get(catId) ?? '') : '',
      };
    }),
    currentStations: ctx.stations,
  };
}

function buildPrompt(data: CompactPayload): string {
  return `You are a restaurant POS (point-of-sale) menu configuration assistant.

Given the menu data below, propose improvements as a list of JSON patches.
Focus on three things:

1. STATION ASSIGNMENT — Infer which single prep station each item belongs to based on its name, description, and category. Common stations: Grill, Fry, Cold, Bar, Pastry, Expo, Deli. Examples:
   - "Buffalo Wings" → Fry
   - "Caesar Salad" → Cold
   - "Margarita" → Bar
   - "Cheesecake" → Pastry
   - Only propose a station if you're confident. Skip ambiguous items.

2. POS DISPLAY NAMES — If posName is empty OR the item name is longer than 15 characters, propose a short posDisplayName that fits in 15 characters while preserving meaning. Use smart abbreviations ("Spinach Artichoke Dip" → "Spin Artch Dip").

3. ITEM DESCRIPTIONS — If desc is empty or fewer than 20 characters and you can infer an accurate 1-sentence description from the item name + category, propose one. Do NOT fabricate ingredients.

MENU DATA:
${JSON.stringify(data)}

Return ONLY a valid JSON object (no markdown fences, no commentary). Schema:
{
  "patches": [
    {
      "id": "p1",
      "kind": "item_station",
      "entityId": 42,
      "label": "Assign to Fry",
      "field": "stationIds",
      "from": "",
      "to": "Fry",
      "confidence": "high",
      "reason": "Wings are deep-fried."
    }
  ],
  "newStations": ["Grill", "Fry", "Cold"],
  "summary": "Assigned 48 stations, shortened 12 names, added 5 descriptions."
}

kind must be one of: "item_station", "item_rename", "item_description", "category_rename"
confidence must be one of: "high", "medium", "low"
Only include patches that add real value — skip items already correctly configured.`;
}

function parseResponse(text: string): AiEnhanceResult {
  // Strip markdown fences if present, then extract first JSON object
  const stripped = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in AI response.');

  const parsed = JSON.parse(match[0]) as Partial<AiEnhanceResult>;

  // Assign stable sequential IDs so the UI can key rows reliably
  const patches = (parsed.patches ?? []).map((p, idx) => ({
    ...p,
    id: p.id ?? `p${idx}`,
  }));

  return {
    patches,
    newStations: parsed.newStations ?? [],
    summary: parsed.summary ?? 'AI enhancement complete.',
  };
}

export async function enhanceMenu(ctx: MenuContext): Promise<AiEnhanceResult> {
  const payload = buildPayload(ctx);
  const prompt = buildPrompt(payload);

  // The Anthropic key lives in the `ai-enhance` Edge Function, not the browser.
  // supabase-js attaches the user's session token; only logged-in users can call it.
  const { data, error } = await supabase.functions.invoke('ai-enhance', {
    body: { prompt, model: MODEL, max_tokens: 16000 },
  });

  if (error) throw new Error(`AI enhance request failed: ${error.message}`);
  if (data?.error) throw new Error(data.error);

  const text = (data as { text?: string })?.text ?? '';
  return parseResponse(text);
}
