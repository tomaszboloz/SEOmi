import type { CrawledPageSummary } from '@/types';
import type { SemanticMap } from '@/services/semanticGraph/types';
import {
  clusterTemplates,
  governTemplates,
  type TemplateEvent,
  type TemplatePage,
} from '@/services/templateGovernor';

export interface TemplateAdapterOptions {
  /** Optional project/run-scoped subtopic mapping: url -> subtopicId */
  subtopicsByUrl?: Record<string, string>;
  minPages?: number;
  sharedShare?: number;
  thinBelow?: number;
  noindexBelow?: number;
  uniqueVariableBelow?: number;
}

export const subtopicsFromGraph = (graph?: SemanticMap | null): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const node of graph?.nodes ?? []) {
    const url = node.page?.final_url || node.page?.url;
    const subtopic = node.page?.tas_subtopic_id?.trim();
    if (url && subtopic) {
      map[url] = subtopic;
    }
  }
  return map;
};

export const subtopicsFromAuthorityReport = (
  report?: { coverage?: Array<{ subtopicId: string; urls: string[] }> } | null,
): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const row of report?.coverage ?? []) {
    for (const url of row.urls ?? []) {
      if (url && row.subtopicId) {
        map[url] = row.subtopicId;
      }
    }
  }
  return map;
};

/** Pages without retained main-content excerpts are skipped: no text means no information-gain claim. */
export const buildTemplateEvents = (
  pages: CrawledPageSummary[],
  options?: TemplateAdapterOptions,
): TemplateEvent[] => {
  const withText: TemplatePage[] = pages.flatMap((p) => {
    if (typeof p.http_status === 'number' && (p.http_status < 200 || p.http_status >= 400)) {
      return [];
    }
    const text = (p.semantic_excerpts ?? []).join(' ').trim();
    if (!text) return [];
    const domSignature = p.template_dom_signature?.trim() || undefined;
    const subtopicId =
      p.tas_subtopic_id?.trim() ||
      options?.subtopicsByUrl?.[p.final_url || p.url]?.trim() ||
      null;
    const sampledWords = text.split(/\s+/).filter(Boolean).length;
    const wordCount = typeof p.word_count === 'number' && p.word_count > 0 ? p.word_count : sampledWords;
    const sampleCoverageRatio = wordCount >= 800 ? sampledWords / wordCount : 1;
    return [
      {
        url: p.final_url || p.url,
        text,
        domSignature,
        domSignatureProvenance: domSignature ? 'crawler' : 'unavailable',
        injectedVariables: p.template_injected_variables,
        injectedVariablesProvenance:
          p.template_injected_variables === undefined ? 'unavailable' : 'crawler',
        subtopicId,
        wordCount,
        sampleCoverageRatio,
      },
    ];
  });
  return governTemplates(clusterTemplates(withText), options);
};
