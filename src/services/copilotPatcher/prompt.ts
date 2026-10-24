import { analyzeTarget } from './analyze';
import type { PatchTarget } from './types';

const list = (items: string[]): string => items.map((item) => `"${item}"`).join(', ');

/**
 * Surgical Content Patch prompt: carries the real H1/H2, the paragraph to change, missing entities,
 * the Answer-First and subject-predicate-object rules and the fragments to drop.
 */
export const buildPatchPrompt = (target: PatchTarget): string => {
  const { dangling, spoGaps, missing } = analyzeTarget(target);
  return [
    `Rewrite ONE paragraph of a web page in language "${target.language || 'en'}". Change as little as possible.`,
    `Page H1: ${target.h1}`,
    target.h2.length ? `Page H2 list: ${list(target.h2)}` : '',
    target.heading ? `The paragraph sits under: ${target.heading}` : 'The paragraph sits under no heading.',
    'Paragraph to change:',
    '"""',
    target.paragraph,
    '"""',
    'Rules:',
    '- Answer first: put the direct answer in the first sentence.',
    '- Each sentence states a clear subject, predicate and object; name the subject instead of "it", "this", "they".',
    '- Keep every number, unit and source exactly as written. Do not add new numbers, studies, quotes or claims.',
    dangling.length ? `Fix these sentences that open with a pronoun without an antecedent: ${list(dangling.map((item) => item.sentence))}.` : '',
    spoGaps.length ? `Name the subject or object in these sentences: ${list(spoGaps.map((item) => item.sentence))}.` : '',
    missing.length ? `Work in these entities only where they fit naturally: ${list(missing)}.` : '',
    target.removeFragments.length ? `Remove these fragments: ${list(target.removeFragments)}.` : '',
    'Return only the rewritten paragraph as plain text, with no comments and no markdown fences.',
  ].filter(Boolean).join('\n');
};
