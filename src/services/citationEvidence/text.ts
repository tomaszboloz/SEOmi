const CONTEXT_STOP_WORDS = new Set([
  'a', 'an', 'and', 'the', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'by',
  'i', 'oraz', 'ale', 'dla', 'do', 'na', 'w', 'we', 'z', 'ze', 'że', 'jest',
]);

export const contextTokens = (value: string): string[] => [...new Set(
  value.normalize('NFKC').toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !CONTEXT_STOP_WORDS.has(token)),
)];

export const normalizeContextPhrase = (value: string): string => value
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

