import { tokenCount } from './text';

/** ADR 0005 (GEM-63-D01): chunk length is counted in words (two characters per unit for CJK scripts). */
export const AIO_LENGTH_UNIT = 'words' as const;

/** Rough LLM token estimate for display only; never used for chunk boundaries or scores. */
export const estimateModelTokens = (text: string, charBased = false): number => {
  const units = tokenCount(text, charBased);
  return Math.ceil(charBased ? units * 1.3 : units * 1.35);
};
