import { semanticPageLanguage } from '@/services/semanticText';
import { chunkSectionsAioR } from './chunking';
import { scoreChunk } from './chunkScore';
import { rulesFor } from './languageRules';
import { extractTriples } from './spo';
import { wordsOf } from './text';
import { aioRProfile } from './profile';
import { extractabilityOf } from './extractability';
import { AIO_WEAK_CHUNK, type AioPage, type AioPageReport, type AioSkipReason } from './types';

const MAX_WEAK = 5;
const pct = (value: number): number => Math.round(Math.max(0, Math.min(1, value)) * 1000) / 10;

export { extractabilityOf } from './extractability';

const skipReason = (page: AioPage): AioSkipReason | undefined => {
  if (page.http_status >= 400 || page.http_status === 0) return 'request-error';
  if (!page.rag_sections) return 'no-sections';
  return page.rag_sections.some((section) => section.paragraphs.some((paragraph) => paragraph.trim().length > 0)) ? undefined : 'no-content';
};

const empty = (url: string, language: string, status: 'supported' | 'uncertain' | 'unsupported', skipped: AioSkipReason): AioPageReport => ({
  url, score: 0, selfContainment: 0, spoDensity: 0, extractability: 0, language, coverage: 'basic', languageStatus: status, availability: 'unavailable', chunkCount: 0, danglingCount: 0, tripleCount: 0, wordCount: 0, weakChunks: [], skipped,
});

/** AIO-R page score: .80 mean chunk score + .20 structural extractability. */
export const scorePageAio = (page: AioPage, market = 'und'): AioPageReport => {
  const inputLanguage = semanticPageLanguage(page) ?? page.document_language ?? '';
  const { language, rules, status } = rulesFor(inputLanguage || 'und');
  const reason = skipReason(page);
  if (reason) return empty(page.final_url || page.url, language, status, reason);
  const sections = page.rag_sections ?? [];
  const coreTerms = page.focus_terms?.map((term) => term.term) ?? [];
  const profile = aioRProfile(language, market);
  const chunks = chunkSectionsAioR(sections, rules.charBased, { coreTerms }).map((chunk) => scoreChunk(chunk, rules));
  const text = sections.flatMap((section) => section.paragraphs).join('\n');
  const words = wordsOf(text, rules.charBased).length / (rules.charBased ? 2 : 1);
  const triples = extractTriples(text, rules).length;
  const selfContainment = chunks.reduce((sum, chunk) => sum + chunk.selfContainment, 0) / Math.max(chunks.length, 1);
  const spo = Math.min(1, ((triples / Math.max(words, 1)) * 100) / profile.thresholds.spoTarget);
  const extractability = extractabilityOf(sections);
  const meanChunkScore = chunks.reduce((sum, chunk) => sum + chunk.score, 0) / Math.max(chunks.length, 1);
  const unknownReasons = [
    ...(status === 'unsupported' ? ['language-rules-unsupported; lexical signals remain partial'] : []),
    ...(chunks.some((chunk) => chunk.selfContainmentDetails?.anchorStatus === 'unknown') ? ['core-anchor-not-supplied; no-entity contribution is unknown'] : []),
  ];
  return {
    url: page.final_url || page.url,
    score: Math.round((0.8 * meanChunkScore + 20 * extractability)),
    selfContainment: pct(selfContainment),
    spoDensity: pct(spo),
    extractability: pct(extractability),
    language,
    coverage: rules.coverage,
    languageStatus: status,
    availability: status === 'supported' ? 'complete' : 'partial',
    chunkCount: chunks.length,
    danglingCount: chunks.filter((chunk) => chunk.issues.includes('dangling-pronoun')).length,
    tripleCount: triples,
    wordCount: Math.round(words),
    meanChunkScore: Math.round(meanChunkScore * 10) / 10,
    profile,
    unknownReasons,
    weakChunks: chunks.filter((chunk) => chunk.score < AIO_WEAK_CHUNK).sort((a, b) => a.score - b.score).slice(0, MAX_WEAK),
  };
};
