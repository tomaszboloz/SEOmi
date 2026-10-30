import {
  bandFor, computeSfs, SFS_LEXICAL_WEIGHTS, SFS_SEMANTIC_WEIGHTS, trsGroup, type FallbackMode, type PageFocus, type TrsGroup,
} from '@/services/siteFocus';
import type { LabelMatrix, ManualLabel, ScaleOutcome } from './types';

const LABELS: ManualLabel[] = ['off-topic', 'borderline', 'on-topic'];
const LABEL_OF: Record<TrsGroup, ManualLabel> = { 'off-topic': 'off-topic', borderline: 'borderline', strong: 'on-topic' };
const round1 = (value: number): number => Math.round(value * 10) / 10;
const emptyGroups = (): Record<TrsGroup, number> => ({ 'off-topic': 0, borderline: 0, strong: 0 });

/**
 * Raw TRS before scaling and clamping, rebuilt from the reported components. The components are
 * rounded to 0.1 percentage points, so this is a sensitivity estimate, not the engine's exact value.
 */
export const rawTrs = (page: Pick<PageFocus, 'similarity' | 'keywordOverlap' | 'semanticDrift'>, mode: FallbackMode): number => {
  const [sim, overlap, drift] = [page.similarity / 100, page.keywordOverlap / 100, page.semanticDrift / 100];
  return mode !== 'lexical'
    ? SFS_SEMANTIC_WEIGHTS.similarity * sim + SFS_SEMANTIC_WEIGHTS.overlap * overlap - SFS_SEMANTIC_WEIGHTS.drift * drift
    : SFS_LEXICAL_WEIGHTS.overlap * overlap - SFS_LEXICAL_WEIGHTS.drift * drift;
};

const content = (pages: PageFocus[]): PageFocus[] => pages.filter((page) => !page.skipped && page.type !== 'technical');

/** SFS, band and TRS groups the same crawl would get with another TRS multiplier (GEM-52-04, D01). */
export const scaleOutcome = (pages: PageFocus[], mode: FallbackMode, scale: number): ScaleOutcome => {
  const rescaled = pages.map((page) => (page.skipped ? page : { ...page, trs: round1(Math.max(0, Math.min(100, rawTrs(page, mode) * scale))) }));
  const groups = emptyGroups();
  content(rescaled).forEach((page) => { groups[trsGroup(page.trs)] += 1; });
  if (!rescaled.some((page) => !page.skipped)) return { scale, sfs: null, band: null, groups };
  const { score } = computeSfs(rescaled);
  return { scale, sfs: score, band: bandFor(score), groups };
};

/** Content pages per 10-point TRS bucket; 100 falls in the last bucket. */
export const trsHistogram = (pages: PageFocus[]): number[] => {
  const buckets = Array.from({ length: 10 }, () => 0);
  content(pages).forEach((page) => { buckets[Math.min(9, Math.floor(page.trs / 10))] += 1; });
  return buckets;
};

const normalizeUrl = (url: string): string => url.replace(/#.*$/, '').replace(/\/+$/, '');

/** Manual labels against predicted TRS groups; labels for URLs the crawl did not score are listed, not guessed. */
export const labelMatrix = (pages: PageFocus[], labels: Record<string, ManualLabel> | undefined): LabelMatrix | null => {
  const entries = Object.entries(labels ?? {});
  if (!entries.length) return null;
  const byUrl = new Map(pages.filter((page) => !page.skipped).map((page) => [normalizeUrl(page.url), page]));
  const matrix = Object.fromEntries(LABELS.map((label) => [label, emptyGroups()])) as LabelMatrix['matrix'];
  const result: LabelMatrix = { labelled: 0, matrix, agreementPct: null, falseOffTopic: [], missedOffTopic: [], unmatchedLabels: [] };
  let agree = 0;
  entries.sort((a, b) => (a[0] < b[0] ? -1 : 1)).forEach(([url, label]) => {
    const page = byUrl.get(normalizeUrl(url));
    if (!page || !LABELS.includes(label)) { result.unmatchedLabels.push(url); return; }
    const predicted = trsGroup(page.trs);
    matrix[label][predicted] += 1;
    result.labelled += 1;
    if (LABEL_OF[predicted] === label) agree += 1;
    if (label === 'on-topic' && predicted === 'off-topic') result.falseOffTopic.push(url);
    if (label === 'off-topic' && predicted === 'strong') result.missedOffTopic.push(url);
  });
  result.agreementPct = result.labelled ? round1((agree / result.labelled) * 100) : null;
  return result;
};
