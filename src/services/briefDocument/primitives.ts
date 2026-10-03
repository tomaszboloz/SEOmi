import i18n from '@/i18n';

export const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
export const briefText = (key: string, variables?: Record<string, unknown>): string => i18n.t(`runtimeErrors.contentBrief.${key}`, variables);
export const normalizeHttpUrl = (value: string | null | undefined): string => {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return value.trim();
    url.hash = '';
    return url.toString();
  } catch { return value.trim(); }
};
export const extractDraftParagraphs = (draft: string): string[] => draft.split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean);

export const isHttpSourceUrl = (value: string) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};
const evidenceStopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'are', 'from', 'to', 'of', 'a', 'an', 'or', 'in', 'on', 'is', 'jest', 'oraz', 'dla', 'z', 'w', 'na', 'do', 'i', 'że']);
export const evidenceTokens = (value: string): string[] => [...new Set(
  value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((token) => token.length >= 3 && !evidenceStopWords.has(token)),
)];
