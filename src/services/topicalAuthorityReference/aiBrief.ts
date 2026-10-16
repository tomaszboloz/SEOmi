import { sanitizeBrief, type BriefDeps } from '@/services/siteFocusBenchmark';
import { buildAuthorityPrompt, type GapBrief } from '@/services/topicalAuthority';

export type AuthorityBriefOutcome =
  | { status: 'ok'; text: string; cached: boolean }
  | { status: 'no-key' }
  | { status: 'empty' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

const cache = new Map<string, { prompt: string; text: string }>();

export const clearAuthorityBriefCache = (): void => cache.clear();

/** AI content brief for a missing sub-topic; cached in memory per sub-topic while the prompt is unchanged. */
export const generateGapBrief = async (
  deps: BriefDeps, brief: GapBrief, coreLabel: string, language: string, options: { signal?: AbortSignal; force?: boolean } = {},
): Promise<AuthorityBriefOutcome> => {
  const prompt = buildAuthorityPrompt(brief, coreLabel, language);
  const hit = cache.get(brief.subtopicId);
  if (hit && hit.prompt === prompt && !options.force) return { status: 'ok', text: hit.text, cached: true };
  if (!deps.isConfigured()) return { status: 'no-key' };
  if (options.signal?.aborted) return { status: 'cancelled' };
  try {
    const text = sanitizeBrief(await deps.generateText(prompt));
    if (options.signal?.aborted) return { status: 'cancelled' };
    if (!text) return { status: 'empty' };
    cache.set(brief.subtopicId, { prompt, text });
    return { status: 'ok', text, cached: false };
  } catch (error) {
    return options.signal?.aborted ? { status: 'cancelled' } : { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
};
