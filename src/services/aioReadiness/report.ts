import { scorePageAio } from './page';
import { AIO_VERSION, type AioBand, type AioOptions, type AioPage, type AioReport } from './types';

export const MAX_WEAK_PASSAGES = 25;

export const aioBandFor = (score: number): AioBand => {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'moderate';
  if (score >= 40) return 'weak';
  return 'critical';
};

const mean = (values: number[]): number => (values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0);

/** Site-level AI Overviews / RAG citability: the mean of the scored pages (pages without sections are skipped, not zeroed). */
export const buildAioReport = (pages: AioPage[], options: AioOptions = {}): AioReport => {
  const reports = pages.map(scorePageAio);
  const scored = reports.filter((page) => !page.skipped);
  const score = mean(scored.map((page) => page.score));
  return {
    score,
    band: aioBandFor(score),
    selfContainment: mean(scored.map((page) => page.selfContainment)),
    spoDensity: mean(scored.map((page) => page.spoDensity)),
    extractability: mean(scored.map((page) => page.extractability)),
    pages: reports,
    scoredCount: scored.length,
    skippedCount: reports.length - scored.length,
    weakPassages: scored
      .flatMap((page) => page.weakChunks.map((chunk) => ({ ...chunk, url: page.url })))
      .sort((a, b) => a.score - b.score || (a.url < b.url ? -1 : 1))
      .slice(0, MAX_WEAK_PASSAGES),
    basicRuleLanguages: [...new Set(scored.filter((page) => page.coverage === 'basic').map((page) => page.language))].sort(),
    generatedAt: options.now ?? new Date().toISOString(),
    pageCount: pages.length,
    version: AIO_VERSION,
  };
};
