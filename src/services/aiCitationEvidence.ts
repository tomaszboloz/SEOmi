import type { CrawlRunRecord } from '@/types';
import type { AiCitationEvidence } from './citationEvidence/types';
import { normalizeHttpUrl, citationCandidates } from './citationEvidence/urls';
import { citationAliases } from './citationEvidence/aliases';
import { buildContextMatch } from './citationEvidence/context';

export type { CrawlCitationMatchKind, AiCitationTextSpan, AiCitationTermEvidence, AiCitationContextMatch, AiCitationEvidence } from './citationEvidence/types';

/** Match a model-mentioned URL only against records already in the chosen crawl. */
export const matchAiCitationToCrawl = (citation: string, run: CrawlRunRecord | null, responseText?: string): AiCitationEvidence => {
  const normalizedUrl = normalizeHttpUrl(citation.trim());
  const base = { citation, normalizedUrl, matched: false };
  if (!normalizedUrl || !run || !Array.isArray(run.result?.pages)) return base;

  const aliases = citationAliases(run.result.pages);

  for (const candidate of citationCandidates(citation)) {
    const normalized = normalizeHttpUrl(candidate);
    if (!normalized) continue;
    const match = aliases.get(normalized);
    if (!match) continue;
    return { ...base, matched: true, matchKind: match.matchKind, page: {
      url: match.page.url,
      final_url: match.page.final_url,
      title: match.page.title,
      http_status: match.page.http_status,
      indexability_status: match.page.indexability_status,
      semantic_terms: match.page.semantic_terms,
      semantic_excerpts: match.page.semantic_excerpts,
    }, context: buildContextMatch(match.page, responseText) };
  }
  return base;
};
