/**
 * Search over the original Polish product names.
 *
 * Both the query and the text are folded (lowercase, no diacritics, ł→l), so
 * "maslo" finds "Masło" and "slaska" finds "śląska". The query is split into
 * tokens and every token must occur somewhere ("mleko 3,2" finds
 * "Mleko UHT 3,2%").
 */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

export function queryTokens(query: string): string[] {
  return foldText(query)
    .split(/[\s;]+/)
    .map((t) => t.replace(/^[.,:!?()"„“]+|[.,:!?()"„“%]+$/g, ''))
    .filter(Boolean);
}

/** True when every token of the query occurs in the folded haystack. */
export function matchesTokens(foldedHaystack: string, tokens: string[]): boolean {
  return tokens.every((t) => foldedHaystack.includes(t));
}
