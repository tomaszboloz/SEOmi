import type { AioChunk } from '@/services/aioReadiness';
import type { PatchTarget } from '@/services/copilotPatcher';
import type { CrawledPageSummary } from '@/types';

type Passage = AioChunk & { url: string };

const unique = (values: string[]): string[] => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

/** Maps only crawl evidence into the contextual patch contract; absent evidence stays empty. */
export const patchTargetForPassage = (page: CrawledPageSummary | undefined, passage: Passage): PatchTarget => {
  const h1 = page?.heading_texts?.h1?.[0] ?? '';
  const h2 = page?.heading_texts?.h2 ?? page?.rag_sections?.filter((section) => section.level === 2).map((section) => section.heading) ?? [];
  const pageEntities = page?.semantic_terms ?? [];
  return {
    h1,
    h2: unique(h2),
    heading: passage.heading || null,
    paragraph: passage.text,
    language: page?.semantic_language ?? page?.document_language ?? '',
    pageEntities: unique(pageEntities).slice(0, 60),
    missingEntities: [],
    removeFragments: [],
  };
};

export const pageHasPatchContext = (page: CrawledPageSummary | undefined): boolean => Boolean(
  page?.heading_texts?.h1?.length || page?.heading_texts?.h2?.length || page?.rag_sections?.length,
);
