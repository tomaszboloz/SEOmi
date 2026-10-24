import type { DanglingPronoun, PatchTarget, SpoGap } from './types';

/** Sentence-initial pronouns that need an antecedent inside the same paragraph. English and Polish only; other languages stay unflagged. */
const PRONOUNS: Record<string, string[]> = {
  en: ['it', 'this', 'that', 'these', 'those', 'they', 'he', 'she'],
  pl: ['to', 'ten', 'ta', 'te', 'ci', 'oni', 'ona', 'on', 'one', 'tamto'],
};

const SENTENCE = /[^.!?…。！？]+[.!?…。！？]?/gu;
const WORD = /[\p{L}\p{N}-]+/gu;

const sentencesOf = (text: string): string[] => (text.match(SENTENCE) ?? []).map((part) => part.trim()).filter(Boolean);

const wordsOf = (text: string): string[] => (text.match(WORD) ?? []).map((word) => word.toLocaleLowerCase());

/**
 * Flags sentences that open with a pronoun while the paragraph has no earlier sentence to refer to,
 * i.e. the paragraph's first sentence. Later pronouns are fine because an earlier sentence can be the antecedent.
 * A heuristic: it names the sentence for a human, it does not claim the text is wrong.
 */
export const findDanglingPronouns = (paragraph: string, language: string): DanglingPronoun[] => {
  const list = PRONOUNS[language.toLowerCase().slice(0, 2)] ?? [];
  const first = sentencesOf(paragraph)[0];
  const word = first ? wordsOf(first)[0] : undefined;
  return first && word && list.includes(word) ? [{ sentence: first, pronoun: word }] : [];
};

/**
 * SPO gap: a sentence that mentions none of the known entities (subject or object missing)
 * in a paragraph that otherwise does. Entities come from the page; nothing is invented.
 */
export const findSpoGaps = (paragraph: string, entities: string[]): SpoGap[] => {
  const known = entities.map((entity) => entity.toLocaleLowerCase()).filter(Boolean);
  if (!known.length) return [];
  const sentences = sentencesOf(paragraph);
  const mentions = (sentence: string): boolean => known.some((entity) => sentence.toLocaleLowerCase().includes(entity));
  if (!sentences.some(mentions)) return [];
  return sentences.filter((sentence) => !mentions(sentence) && wordsOf(sentence).length >= 4).map((sentence) => ({ sentence }));
};

/** Entities the page should name in this paragraph but does not. */
export const missingEntities = (paragraph: string, wanted: string[]): string[] => {
  const text = paragraph.toLocaleLowerCase();
  return wanted.filter((entity) => entity && !text.includes(entity.toLocaleLowerCase()));
};

export const analyzeTarget = (target: PatchTarget): { dangling: DanglingPronoun[]; spoGaps: SpoGap[]; missing: string[] } => ({
  dangling: findDanglingPronouns(target.paragraph, target.language),
  spoGaps: findSpoGaps(target.paragraph, target.pageEntities),
  missing: missingEntities(target.paragraph, target.missingEntities),
});
