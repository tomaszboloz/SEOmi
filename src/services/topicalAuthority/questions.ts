export type QuestionSource = 'serp-paa' | 'google-suggest' | 'competitor-headings';

export interface QuestionInputs {
  /** People Also Ask rows exactly as a SERP provider returned them. Absent when no provider supplies PAA. */
  paa?: string[];
  suggestions?: string[];
  /** Competitor H2/H3 texts. */
  headings?: string[];
}

export interface QuestionSets {
  /** Only real PAA. Empty means no PAA source: an empty state, never a substitute. */
  paa: string[];
  paaAvailable: boolean;
  /** Questions from other sources, each labelled with where it came from. */
  related: Array<{ source: Exclude<QuestionSource, 'serp-paa'>; question: string }>;
}

const isQuestion = (text: string): boolean => /[?？]\s*$/.test(text.trim());
const clean = (items: string[] | undefined): string[] => [...new Set((items ?? []).map((item) => item.replace(/\s+/g, ' ').trim()).filter(Boolean))];

/**
 * Separates PAA from look-alikes. Suggest and heading questions are useful, but they are not PAA and are
 * never presented as such; without a SERP PAA source `paaAvailable` is false and `paa` stays empty.
 */
export const resolveQuestions = (input: QuestionInputs): QuestionSets => {
  const paa = clean(input.paa);
  const taken = new Set(paa.map((item) => item.toLowerCase()));
  const related: QuestionSets['related'] = [];
  const add = (source: Exclude<QuestionSource, 'serp-paa'>, items: string[] | undefined) => clean(items).filter(isQuestion).forEach((question) => {
    if (taken.has(question.toLowerCase())) return;
    taken.add(question.toLowerCase());
    related.push({ source, question });
  });
  add('google-suggest', input.suggestions);
  add('competitor-headings', input.headings);
  return { paa, paaAvailable: paa.length > 0, related };
};
