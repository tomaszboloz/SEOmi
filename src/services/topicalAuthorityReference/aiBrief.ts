import { runAiBrief, type AiBriefOutcome, type BriefCache } from '@/services/aiBriefRunner';
import { sanitizeBrief, type BriefDeps } from '@/services/siteFocusBenchmark';
import { buildAuthorityPrompt, type GapBrief } from '@/services/topicalAuthority';

export type AuthorityBriefOutcome = AiBriefOutcome;

const cache: BriefCache = new Map();

export const clearAuthorityBriefCache = (): void => cache.clear();

/** AI content brief for a missing sub-topic; cached in memory per sub-topic while the prompt is unchanged. */
export const generateGapBrief = async (
  deps: BriefDeps, brief: GapBrief, coreLabel: string, language: string, options: { signal?: AbortSignal; force?: boolean } = {},
): Promise<AuthorityBriefOutcome> => runAiBrief({ deps, prompt: buildAuthorityPrompt(brief, coreLabel, language), sanitize: sanitizeBrief, signal: options.signal, cache: { store: cache, key: brief.subtopicId, force: options.force } });
