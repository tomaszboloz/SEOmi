import type { CrawledPageSummary } from '@/types';

export interface InformationGainRequestInput {
  projectId: string;
  site: string;
  competitors: string[];
  pages: CrawledPageSummary[];
}

export interface InformationGainTarget { page: CrawledPageSummary; text: string }

export const informationGainText = (page: CrawledPageSummary): string => [
  ...(page.semantic_excerpts ?? []),
  ...(page.rag_sections ?? []).flatMap((section) => section.paragraphs),
].join('\n').slice(0, 20_000).trim();

/** The page with the most retained text is the outreach source candidate. */
export const informationGainTarget = (pages: CrawledPageSummary[]): InformationGainTarget | null => pages
  .map((page) => ({ page, text: informationGainText(page) }))
  .filter(({ page, text }) => Boolean(text) && Boolean(page.final_url || page.url))
  .sort((left, right) => right.text.length - left.text.length)[0] ?? null;

/**
 * Unambiguous identity of an Information Gain request (#143).
 *
 * Every field the producer reads from the selected page is encoded as
 * structured JSON, so list boundaries survive: `["sleep,health"]` and
 * `["sleep","health"]`, or paragraphs `["alpha/beta"]` and `["alpha","beta"]`,
 * give different keys. No hash is used, so distinct inputs cannot collide.
 * Only the selected target page is encoded, so the key stays bounded.
 */
export const informationGainRequestKey = (input: InformationGainRequestInput): string => {
  const target = informationGainTarget(input.pages);
  const page = target?.page;
  return JSON.stringify([
    input.projectId,
    input.site,
    input.competitors,
    page ? [
      page.url,
      page.final_url ?? null,
      page.title ?? null,
      page.word_count,
      page.semantic_terms ?? null,
      page.semantic_excerpts ?? null,
      (page.rag_sections ?? []).map((section) => section.paragraphs),
    ] : null,
  ]);
};
