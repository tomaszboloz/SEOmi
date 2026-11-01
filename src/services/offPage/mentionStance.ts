/**
 * Stance of a brand mention (#93 GEM-93-07, T03). Deterministic cue lists, applied only to the sentences
 * that contain the brand: a negation, a critical word or a quoted/attributed opinion turns the mention into
 * something that is never counted as a recommendation. Cues are uncalibrated evidence, not sentiment
 * analysis, and semantic co-occurrence never proves that an LLM endorses the brand.
 */
import { mentionsInSense, type AliasSense } from './aliasSense';
import { splitSentences } from '@/services/textSentences';

export type MentionStance = 'neutral' | 'negated' | 'critical' | 'quoted';

const NEGATIONS = new Set([
  'not', 'never', 'no', 'without', "don't", "doesn't", "isn't", "wasn't", "won't", 'nie', 'nigdy', 'bez', 'żaden', 'żadna',
  'kein', 'keine', 'nicht', 'pas', 'jamais', 'nunca', 'sin', 'non', 'mai', 'não', 'sem', 'без', 'не', 'нет', 'никогда',
]);
const CJK_NEGATION = /不|没有|ない|않|아니/u;
/** Lower-case stems; a token starting with one counts (so "oszustwa" matches "oszust"). */
const CRITICAL_STEMS = [
  'scam', 'fraud', 'avoid', 'worst', 'terrible', 'awful', 'complain', 'lawsuit', 'ripoff', 'rip-off', 'misleading',
  'oszust', 'unikaj', 'najgorsz', 'fataln', 'skarg', 'pozew', 'naciąg', 'wprowadza w błąd',
  'betrug', 'vermeid', 'arnaque', 'escroquer', 'estafa', 'fraude', 'truffa', 'golpe', 'мошенни', 'обман', '詐欺', '骗', '사기',
];
/** Phrases and scripts without spaces between words are matched as substrings. */
const SUBSTRING = /\s|[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/u;
const ATTRIBUTION = /\b(?:according to|said|says|claims?|allegedly)\b|według|zdaniem|twierdzi|podobno|\blaut\b|\bselon\b|\bsegún\b|\bsecondo\b|\bsegundo\b|по словам|据|によると|에 따르면/iu;
const QUOTES = /["„“”«»「」『』]/u;

const sentences = (text: string): string[] => splitSentences(text);
const tokens = (text: string): string[] => text.toLocaleLowerCase().split(/[^\p{L}\p{N}'’-]+/u).filter(Boolean).map((token) => token.replace(/’/gu, "'"));
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when the alias is wrapped in quotation marks within the sentence. */
const quotedAlias = (sentence: string, alias: string): boolean =>
  new RegExp(`["„“«「『][^"”»」』]*${escape(alias.trim())}[^"”»」』]*["”»」』]`, 'iu').test(sentence);

const RANK: MentionStance[] = ['neutral', 'quoted', 'negated', 'critical'];

const stanceOf = (sentence: string, aliases: string[]): MentionStance => {
  const lower = sentence.toLocaleLowerCase();
  const words = tokens(sentence);
  if (CRITICAL_STEMS.some((stem) => (SUBSTRING.test(stem) ? lower.includes(stem) : words.some((word) => word.startsWith(stem))))) return 'critical';
  if (words.some((word) => NEGATIONS.has(word) || /n't$/u.test(word)) || CJK_NEGATION.test(sentence)) return 'negated';
  if (ATTRIBUTION.test(sentence) || (QUOTES.test(sentence) && aliases.some((alias) => quotedAlias(sentence, alias)))) return 'quoted';
  return 'neutral';
};

/** Strongest stance across the sentences that mention the brand; `neutral` when none of them carries a cue. */
export const mentionStance = (paragraph: string, brandAliases: string[], senses: AliasSense[] = []): MentionStance => {
  const aliases = brandAliases.map((alias) => alias.trim()).filter(Boolean);
  const relevant = sentences(paragraph).filter((sentence) => aliases.some((alias) => mentionsInSense(sentence, alias, senses, paragraph)));
  return relevant.map((sentence) => stanceOf(sentence, aliases)).reduce<MentionStance>((worst, stance) => (RANK.indexOf(stance) > RANK.indexOf(worst) ? stance : worst), 'neutral');
};
