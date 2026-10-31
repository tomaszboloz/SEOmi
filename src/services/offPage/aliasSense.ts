/**
 * Alias and homonym disambiguation for brand mentions (#93). A brand alias such as "Apple" or "Orange" is also
 * a common word. A rule can name context words that mark the other sense (`excludeContext`, checked in the same
 * sentence) or words that must be present for the brand sense (`requireContext`, checked in the paragraph).
 * Rules are user-supplied evidence, not a language model: an alias without a rule keeps the plain whole-word match.
 */
export interface AliasSense {
  alias: string;
  excludeContext?: string[];
  requireContext?: string[];
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-word, case-insensitive, Unicode-aware test. */
export const hasWord = (text: string, word: string): boolean => {
  const trimmed = word.trim();
  return trimmed !== '' && new RegExp(`(?<![\\p{L}\\p{N}])${escape(trimmed)}(?![\\p{L}\\p{N}])`, 'iu').test(text);
};

const ruleFor = (alias: string, senses: AliasSense[]): AliasSense | undefined =>
  senses.find((sense) => sense.alias.trim().toLocaleLowerCase() === alias.trim().toLocaleLowerCase());

/** True when `alias` occurs in `sentence` in its brand sense. `paragraph` supplies the wider context for required words. */
export const mentionsInSense = (sentence: string, alias: string, senses: AliasSense[], paragraph = sentence): boolean => {
  if (!hasWord(sentence, alias)) return false;
  const rule = ruleFor(alias, senses);
  if (!rule) return true;
  if (rule.excludeContext?.some((word) => hasWord(sentence, word))) return false;
  const required = rule.requireContext?.filter((word) => word.trim());
  return !required?.length || required.some((word) => hasWord(paragraph, word));
};
