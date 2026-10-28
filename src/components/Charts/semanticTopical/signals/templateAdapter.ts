import type { CrawledPageSummary } from '@/types';
import type { SemanticMap } from '@/services/semanticGraph/types';
import { clusterTemplates, governTemplates, type TemplateEvent, type TemplatePage } from '@/services/templateGovernor';

export interface TemplateAdapterOptions {
  subtopicsByUrl?: Record<string, string>;
  minPages?: number;
  sharedShare?: number;
  thinBelow?: number;
  noindexBelow?: number;
  uniqueVariableBelow?: number;
}

/** Only explicit TAS identity is accepted; lexical graph cluster IDs are not TAS IDs. */
export const subtopicsFromGraph = (graph?: SemanticMap | null): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const node of graph?.nodes ?? []) {
    const url = node.page?.final_url || node.page?.url;
    const id = node.page?.tas_subtopic_id?.trim();
    if (url && id) result[url] = id;
  }
  return result;
};

export const subtopicsFromAuthorityReport = (report?: { coverage?: Array<{ subtopicId: string; urls: string[] }> } | null): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const row of report?.coverage ?? []) for (const url of row.urls ?? []) if (url && row.subtopicId) result[url] = row.subtopicId;
  return result;
};

/** Pages without retained main-content excerpts are skipped: no text means no information-gain claim. */
export const buildTemplateEvents = (pages: CrawledPageSummary[], options: TemplateAdapterOptions = {}): TemplateEvent[] => {
  const withText: TemplatePage[] = pages.flatMap((p) => {
    if (typeof p.http_status === 'number' && (p.http_status < 200 || p.http_status >= 400)) return [];
    const text = (p.semantic_excerpts ?? []).join(' ').trim();
    if (!text) return [];
    const url = p.final_url || p.url;
    const sampledWords = text.split(/\s+/u).filter(Boolean).length;
    const wordCount = typeof p.word_count === 'number' && p.word_count > 0 ? p.word_count : sampledWords;
    return [{
      url,
      text,
      domSignature: p.template_dom_signature?.trim() || undefined,
      domSignatureProvenance: p.template_dom_signature?.trim() ? 'crawler' : 'unavailable',
      injectedVariables: p.template_injected_variables,
      injectedVariablesProvenance: p.template_injected_variables === undefined ? 'unavailable' : 'crawler',
      subtopicId: p.tas_subtopic_id?.trim() || options.subtopicsByUrl?.[url]?.trim() || null,
      wordCount,
      sampleCoverageRatio: wordCount >= 800 ? Math.min(1, sampledWords / wordCount) : 1,
    }];
  });
  return governTemplates(clusterTemplates(withText), options);
};
