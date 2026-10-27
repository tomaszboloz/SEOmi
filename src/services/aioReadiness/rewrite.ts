import { sanitizeBrief, type BriefDeps } from '@/services/siteFocusBenchmark/rewriteBrief';
import type { AioChunk, AioIssue } from './types';

export type RewriteOutcome =
  | { status: 'ok'; text: string }
  | { status: 'no-key' }
  | { status: 'empty' }
  | { status: 'error'; message: string };

const ISSUE_HINT: Record<AioIssue, string> = {
  'dangling-pronoun': 'Replace pronouns and references like "it", "this" with the explicit entity name.',
  'deictic-context': 'Replace context-dependent words such as here, above or today with explicit references.',
  'no-entity': 'Name the core or pillar topic explicitly inside this passage.',
  'no-answer-first': 'Open with a direct 40-60 word answer to the heading before any context.',
  'filler-opening': 'Remove introductory filler and references to earlier text.',
  'no-facts': 'State concrete facts with units, numbers and named entities.',
  'too-long': 'Split into shorter self-contained paragraphs.',
};

/** Instruction for the model; the output language follows the passage. */
export const buildRewritePrompt = (chunk: Pick<AioChunk, 'heading' | 'text' | 'issues'>): string =>
  [
    'Rewrite the passage so an AI answer engine can quote it on its own (RAG chunk).',
    'Keep the same language and only the facts already present; do not invent numbers or sources.',
    'Rules: answer-first (the first sentence answers the heading), name the subject explicitly in every paragraph, one verifiable fact per sentence, include units.',
    ...chunk.issues.map((issue) => `- ${ISSUE_HINT[issue]}`),
    `Heading: ${chunk.heading || '(none)'}`,
    'Passage:',
    chunk.text,
    'Return only the rewritten passage as plain text.',
  ].join('\n');

/** AI rewrite of one weak passage. Plain text only; nothing is sent when no AI provider is connected. */
export const rewritePassage = async (deps: BriefDeps, chunk: Pick<AioChunk, 'heading' | 'text' | 'issues'>): Promise<RewriteOutcome> => {
  if (!deps.isConfigured()) return { status: 'no-key' };
  try {
    const text = sanitizeBrief(await deps.generateText(buildRewritePrompt(chunk)));
    return text ? { status: 'ok', text } : { status: 'empty' };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
};
