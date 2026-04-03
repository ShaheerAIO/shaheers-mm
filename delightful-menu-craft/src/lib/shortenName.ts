const FILLER_WORDS = new Set(['with', 'and', 'the', 'a', 'of', 'in', 'on']);

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bsandwich\b/gi, 'Sand'],
  [/\bchicken\b/gi, 'Chkn'],
  [/\bbreakfast\b/gi, 'Brkfst'],
  [/\bchocolate\b/gi, 'Choc'],
  [/\bstrawberry\b/gi, 'Strwb'],
  [/\bblueberry\b/gi, 'Blubry'],
  [/\bvanilla\b/gi, 'Van'],
  [/\bcaramel\b/gi, 'Crml'],
  [/\bmozzarella\b/gi, 'Mozz'],
  [/\bparmesan\b/gi, 'Parm'],
  [/\bpepperoni\b/gi, 'Ppni'],
  [/\bmushroom\b/gi, 'Mush'],
  [/\bjalapeno\b/gi, 'Jalp'],
  [/\bjalapenoo\b/gi, 'Jalp'],
  [/\bcheddar\b/gi, 'Chdr'],
  [/\bquesadilla\b/gi, 'Qsdla'],
  [/\bburrito\b/gi, 'Brto'],
  [/\bbuffalo\b/gi, 'Buff'],
  [/\boriginal\b/gi, 'Orig'],
  [/\bclassic\b/gi, 'Clsc'],
  [/\bspecial\b/gi, 'Spcl'],
  [/\bdeluxe\b/gi, 'Dlx'],
  [/\bcrispy\b/gi, 'Crspy'],
  [/\bgrilled\b/gi, 'Grld'],
  [/\bdouble\b/gi, 'Dbl'],
  [/\btriple\b/gi, 'Trpl'],
  [/\bextra\b/gi, 'Xtra'],
  [/\bsmall\b/gi, 'Sm'],
  [/\bmedium\b/gi, 'Med'],
  [/\blarge\b/gi, 'Lg'],
  [/\bcombo\b/gi, 'Cmbo'],
  [/\bspicy\b/gi, 'Spcy'],
  [/\bboneless\b/gi, 'Bnls'],
  [/\bnuggets?\b/gi, 'Nugs'],
  [/\bpiece\b/gi, 'Pc'],
  [/\bpieces\b/gi, 'Pcs'],
  [/\bpotato\b/gi, 'Pot'],
  [/\blemonade\b/gi, 'Lmnd'],
  [/\bbiscuit\b/gi, 'Bsct'],
];

function removeFiller(words: string[]): string[] {
  const filtered = words.filter((w) => !FILLER_WORDS.has(w.toLowerCase()));
  return filtered.length > 0 ? filtered : words;
}

function applyAbbreviations(name: string): string {
  let result = name;
  for (const [pattern, replacement] of ABBREVIATIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function collapseSpaces(s: string): string {
  return s.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Shorten a menu item name to fit within `maxLen` characters while
 * preserving meaning. Applies abbreviations and removes filler words
 * before falling back to truncation.
 */
export function shortenName(name: string, maxLen = 15): string {
  if (name.length <= maxLen) return name;

  // Step 1: remove filler words
  let shortened = collapseSpaces(removeFiller(name.split(' ')).join(' '));
  if (shortened.length <= maxLen) return shortened;

  // Step 2: apply common abbreviations
  shortened = collapseSpaces(applyAbbreviations(shortened));
  if (shortened.length <= maxLen) return shortened;

  // Step 3: abbreviate + remove filler together
  shortened = collapseSpaces(
    applyAbbreviations(removeFiller(name.split(' ')).join(' ')),
  );
  if (shortened.length <= maxLen) return shortened;

  // Step 4: truncate at last word boundary that fits
  if (shortened.length > maxLen) {
    const words = shortened.split(' ');
    let result = '';
    for (const word of words) {
      const candidate = result ? `${result} ${word}` : word;
      if (candidate.length > maxLen - 1) break;
      result = candidate;
    }
    if (result.length > 0 && result.length < shortened.length) {
      return result + '…';
    }
  }

  return shortened.slice(0, maxLen - 1) + '…';
}
