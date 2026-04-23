/**
 * Split pasted bulk text into unique non-empty option names.
 * Newlines, commas, and semicolons act as separators.
 */
export function parseBulkOptionNames(raw: string): string[] {
  const parts = raw
    .split(/[\r\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
