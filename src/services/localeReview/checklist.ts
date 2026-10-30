import { rulesFor } from '../aioReadiness/languageRules.ts';

/**
 * Native-speaker review checklist for locales other than en/pl (#109, #108). The tool only prepares the
 * review: it lists every string next to English with automatic hints and leaves reviewer, date and every
 * checkbox empty. A review counts only when a person fills it in; nothing here marks a locale as reviewed.
 */
export type ReviewFlag = 'missing' | 'same-as-en' | 'placeholders' | 'length';
export interface ReviewItem { key: string; en: string; text: string | undefined; flags: ReviewFlag[] }

type Tree = { [key: string]: unknown };

export const flatten = (tree: unknown, prefix = ''): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!tree || typeof tree !== 'object') return out;
  for (const [key, value] of Object.entries(tree as Tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
};

const placeholders = (text: string): string => [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]).sort().join(',');
/** Brand names, units and codes legitimately stay in English; only longer prose is flagged as possibly untranslated. */
const PROSE = /\p{L}{3,}\s+\p{L}{3,}/u;

export const reviewItems = (en: unknown, target: unknown, prefix = ''): ReviewItem[] => {
  const source = flatten(en);
  const translated = flatten(target);
  return Object.keys(source).filter((key) => key.startsWith(prefix)).map((key) => {
    const text = translated[key];
    const flags: ReviewFlag[] = [];
    if (text === undefined) flags.push('missing');
    else {
      if (text === source[key] && PROSE.test(text)) flags.push('same-as-en');
      if (placeholders(text) !== placeholders(source[key])) flags.push('placeholders');
      const ratio = text.length / Math.max(source[key].length, 1);
      if (source[key].length >= 20 && (ratio < 0.3 || ratio > 3)) flags.push('length');
    }
    return { key, en: source[key], text, flags };
  });
};

const cell = (value: string | undefined): string => (value ?? '—').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

export interface ChecklistOptions { locale: string; prefix?: string; generatedAt: string; flaggedOnly?: boolean }

export const reviewChecklistMarkdown = (items: ReviewItem[], options: ChecklistOptions): string => {
  const shown = options.flaggedOnly ? items.filter((item) => item.flags.length) : items;
  const flagged = items.filter((item) => item.flags.length).length;
  return [
    `# Native review checklist: ${options.locale}${options.prefix ? ` (${options.prefix}*)` : ''}`,
    '',
    `Generated ${options.generatedAt}. Strings: ${items.length}. Automatic hints: ${flagged}.`,
    'Hints are heuristics, not a review. Tick a row only after a native speaker has read it in context.',
    '',
    'Reviewer: ____________________  Native language: ________  Date: __________',
    '',
    '| OK | Key | English | Translation | Hints | Reviewer note |',
    '| --- | --- | --- | --- | --- | --- |',
    ...shown.map((item) => `| [ ] | \`${item.key}\` | ${cell(item.en)} | ${cell(item.text)} | ${item.flags.join(', ') || '—'} |  |`),
    '',
  ].join('\n');
};

/** AIO-R word lists of one language (#108) as a review checklist; en/pl are the baseline and are not listed. */
export const aioRulesChecklistMarkdown = (locale: string, generatedAt: string): string => {
  const { language, rules, status } = rulesFor(locale);
  if (status === 'supported') return `# AIO-R word lists: ${language}\n\n${language} is a baseline language and is not part of this review.\n`;
  if (status === 'unsupported') return `# AIO-R word lists: ${language}\n\nNo rules exist for ${language}; English lists are used as a fallback and results are labelled unsupported.\n`;
  const section = (title: string, words: string[] | undefined, question: string): string[] => [
    `## ${title}`, '', question, '', ...(words ?? []).map((word) => `- [ ] ${word}`), '- Missing words: ____________________', '',
  ];
  return [
    `# AIO-R word lists: ${language} (status: uncertain until a native review is recorded)`,
    '',
    `Generated ${generatedAt}. Tick each entry only if a native speaker confirms it.`,
    '',
    'Reviewer: ____________________  Date: __________',
    '',
    ...section('Dangling references (sentence openers)', rules.dangling, 'Does a sentence that starts with this word usually point back to something said earlier?'),
    ...section('Deictic markers', rules.deictic, 'Does this word depend on page position or time ("here", "above", "today")?'),
    ...section('Filler openings', rules.filler, 'Is this an opening phrase that delays the answer?'),
    ...section('Relation verbs (fact detection)', rules.relations, 'Does this word link a subject to a value or object in a factual statement?'),
  ].join('\n');
};
