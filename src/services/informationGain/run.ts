import type { BenchmarkDeps } from '@/services/siteFocusBenchmark';
import { collectBaseline, type CollectProgress, type UnavailableReason } from './collect';
import { buildIgosReport } from './report';
import type { InfoGainPage, SiteIgos } from './types';

export interface InfoGainInput {
  pages: InfoGainPage[];
  startUrl: string;
  queries: string[];
  language?: string;
  maxDocs?: number;
  signal?: AbortSignal;
  onProgress?: (progress: CollectProgress | { phase: 'analyze' }) => void;
  now?: string;
}

export type InfoGainOutcome =
  | { status: 'unavailable'; reason: UnavailableReason | 'no-content'; error?: string }
  | { status: 'cancelled' }
  | { status: 'ok'; report: SiteIgos; failedDocs: number };

/** Queries from a Core Topic: its label and its leading terms, distinct and short. */
export const queriesForTopic = (label: string, terms: string[]): string[] =>
  [...new Set([label.trim(), terms.slice(0, 3).join(' ').trim()].filter(Boolean))];

/**
 * Information Gain & Originality for a crawl, from real competitor content only.
 * Dependencies are the same SERP and crawler adapters the competitive benchmark uses.
 */
export const runInfoGain = async (deps: BenchmarkDeps, input: InfoGainInput): Promise<InfoGainOutcome> => {
  if (!input.pages.some((page) => page.content_sections?.length)) return { status: 'unavailable', reason: 'no-content' };
  const collected = await collectBaseline(deps, {
    startUrl: input.startUrl, queries: input.queries, maxDocs: input.maxDocs, signal: input.signal, onProgress: input.onProgress,
  });
  if (collected.status !== 'ok') return collected;
  input.onProgress?.({ phase: 'analyze' });
  const report = buildIgosReport({
    pages: input.pages, baselineDocs: collected.docs, queries: collected.queries, source: collected.source, language: input.language, now: input.now,
  });
  if (!report) return { status: 'unavailable', reason: 'no-documents' };
  return { status: 'ok', report, failedDocs: collected.failed };
};
