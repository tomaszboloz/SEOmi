import { semanticPageLanguage } from '@/services/semanticText';
import type { RagSection } from '@/types';
import { chunkSections } from './chunking';
import { scoreChunk } from './chunkScore';
import { rulesFor } from './languageRules';
import { extractTriples } from './spo';
import { wordsOf } from './text';
import { AIO_WEAK_CHUNK, type AioPage, type AioPageReport, type AioSkipReason } from './types';

const SPO_TARGET_PER_100 = 3;
const HEADING_TARGET = 4;
const MAX_WEAK = 5;
const pct = (value: number): number => Math.round(Math.max(0, Math.min(1, value)) * 1000) / 10;

/** Share of structures AI answer engines prefer to lift: tables, ordered/definition lists, a heading outline. */
export const extractabilityOf = (sections: RagSection[]): number => {
  const sum = (key: 'tables' | 'ordered_lists' | 'unordered_lists' | 'definition_lists'): number => sections.reduce((total, section) => total + section[key], 0);
  const outline = sections.filter((section) => section.level === 2 || section.level === 3).length;
  return Math.min(1, 0.3 * Number(sum('tables') > 0) + 0.25 * Number(sum('ordered_lists') > 0) + 0.15 * Number(sum('unordered_lists') > 0) + 0.1 * Number(sum('definition_lists') > 0) + 0.2 * Math.min(1, outline / HEADING_TARGET));
};

const skipReason = (page: AioPage): AioSkipReason | undefined => {
  if (page.http_status >= 400 || page.http_status === 0) return 'request-error';
  if (!page.rag_sections) return 'no-sections';
  return page.rag_sections.some((section) => section.paragraphs.length) ? undefined : 'no-content';
};

const empty = (url: string, language: string, skipped: AioSkipReason): AioPageReport => ({
  url, score: 0, selfContainment: 0, spoDensity: 0, extractability: 0, language, coverage: 'basic', chunkCount: 0, danglingCount: 0, tripleCount: 0, wordCount: 0, weakChunks: [], skipped,
});

/** AI Overviews / RAG readiness of one page: AIO-R = 0.45 self-containment + 0.35 SPO density + 0.20 extractability. */
export const scorePageAio = (page: AioPage): AioPageReport => {
  const { language, rules } = rulesFor(semanticPageLanguage(page) ?? page.document_language ?? '');
  const reason = skipReason(page);
  if (reason) return empty(page.final_url || page.url, language, reason);
  const sections = page.rag_sections ?? [];
  const chunks = chunkSections(sections, rules.charBased).map((chunk) => scoreChunk(chunk, rules));
  const text = sections.flatMap((section) => section.paragraphs).join('\n');
  const words = wordsOf(text, rules.charBased).length / (rules.charBased ? 2 : 1);
  const triples = extractTriples(text, rules).length;
  const selfContainment = chunks.reduce((sum, chunk) => sum + chunk.selfContainment, 0) / Math.max(chunks.length, 1);
  const spo = Math.min(1, ((triples / Math.max(words, 1)) * 100) / SPO_TARGET_PER_100);
  const extractability = extractabilityOf(sections);
  return {
    url: page.final_url || page.url,
    score: Math.round((0.45 * selfContainment + 0.35 * spo + 0.2 * extractability) * 100),
    selfContainment: pct(selfContainment),
    spoDensity: pct(spo),
    extractability: pct(extractability),
    language,
    coverage: rules.coverage,
    chunkCount: chunks.length,
    danglingCount: chunks.filter((chunk) => chunk.issues.includes('dangling-pronoun')).length,
    tripleCount: triples,
    wordCount: Math.round(words),
    weakChunks: chunks.filter((chunk) => chunk.score < AIO_WEAK_CHUNK).sort((a, b) => a.score - b.score).slice(0, MAX_WEAK),
  };
};
