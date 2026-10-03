// Lightweight, dependency-free text normalisation for Polish and English SEO
// phrases. It only has to make inflected forms of the same word land on the
// same features; it is not a linguistic stemmer.

const FOLD: Record<string, string> = { ł: 'l', ß: 'ss', æ: 'ae', ø: 'o', œ: 'oe' };

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'what', 'with', 'my', 'your', 'do', 'does', 'can', 'i',
  'i', 'w', 'we', 'z', 'ze', 'na', 'do', 'od', 'po', 'o', 'u', 'za', 'dla', 'jak', 'czy', 'co', 'to', 'jest', 'sie', 'oraz', 'lub', 'albo', 'ile', 'jaki', 'jaka', 'jakie', 'przez', 'pod', 'nad',
]);

// Longest suffix first. Polish inflection and common English endings.
const SUFFIXES = [
  'owanie', 'owania', 'owaniu', 'ującego', 'ujacego', 'owych', 'owego', 'owej', 'owym', 'ami', 'ach', 'ego', 'emu', 'owi', 'ych', 'ich', 'ymi', 'imi', 'iej', 'nia', 'nie', 'niu',
  'ow', 'om', 'em', 'ie', 'ia', 'iu', 'ej', 'ym', 'im', 'a', 'e', 'i', 'o', 'u', 'y',
  'ization', 'ations', 'ation', 'ments', 'ment', 'ness', 'ings', 'ing', 'ies', 'ied', 'ers', 'er', 'ed', 'es', 's',
];

/** Lower-cases, removes diacritics and punctuation, and collapses whitespace. */
export const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[łßæøœ]/g, (character) => FOLD[character] ?? character)
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// A four-letter stem merges unrelated words ("cukier" and "cukinie" both
// become "cuki"); five letters keep them apart while still joining inflections.
const MIN_STEM = 5;

/** Strips one known suffix while keeping at least MIN_STEM characters of the word. */
export const stem = (word: string): string => {
  if (word.length <= MIN_STEM || /^\d+$/.test(word)) return word;
  for (const suffix of SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= MIN_STEM) return word.slice(0, -suffix.length);
  }
  return word;
};

/** Content-word stems; falls back to all words when a text is only stopwords. */
export const contentStems = (value: string): string[] => {
  const words = normalizeText(value).split(' ').filter(Boolean);
  const content = words.filter((word) => !STOPWORDS.has(word));
  return (content.length ? content : words).map(stem);
};
