import type { CrawledPageSummary } from '@/types';
import { clusterTemplates, governTemplates, type TemplateEvent, type TemplatePage } from '@/services/templateGovernor';

/** Pages without retained main-content excerpts are skipped: no text means no information-gain claim. */
export const buildTemplateEvents = (pages: CrawledPageSummary[]): TemplateEvent[] => {
  const withText: TemplatePage[] = pages.flatMap((p) => {
    const text = (p.semantic_excerpts ?? []).join(' ').trim();
    return text ? [{ url: p.final_url || p.url, text }] : [];
  });
  return governTemplates(clusterTemplates(withText));
};
