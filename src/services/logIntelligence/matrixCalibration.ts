import { classifyCrawl, DEFAULT_MATRIX, type MatrixOptions } from './matrix';

/**
 * Threshold calibration for the Crawl Efficiency Matrix (#92) on labelled cases. The shipped cases are
 * fixtures that encode the intended reading (a weak page that bots hit often is waste; a strong page that
 * bots barely visit is starved). Real logs need the user's own labels, so every value stays overridable.
 */
export interface LabelledCrawlCase { trs: number; hits: number; verdict: 'waste' | 'starvation' | 'ok' }
type Thresholds = Pick<Required<MatrixOptions>, 'wasteMaxTrs' | 'wasteMinHits' | 'starvationMaxHits'>;
export interface MatrixCalibration extends Thresholds { errors: number; cases: number }

export const FIXTURE_CASES: readonly LabelledCrawlCase[] = [
  { trs: 20, hits: 100, verdict: 'waste' }, { trs: 44, hits: 26, verdict: 'waste' }, { trs: 10, hits: 60, verdict: 'waste' },
  { trs: 44, hits: 10, verdict: 'ok' }, { trs: 45, hits: 30, verdict: 'ok' }, { trs: 80, hits: 40, verdict: 'ok' },
  { trs: 70, hits: 2, verdict: 'ok' }, { trs: 90, hits: 0, verdict: 'starvation' }, { trs: 70, hits: 1, verdict: 'starvation' },
  { trs: 60, hits: 12, verdict: 'ok' }, { trs: 30, hits: 5, verdict: 'ok' },
];

const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const distance = (a: Thresholds) => Math.abs(a.wasteMaxTrs - DEFAULT_MATRIX.wasteMaxTrs) + Math.abs(a.wasteMinHits - DEFAULT_MATRIX.wasteMinHits) + Math.abs(a.starvationMaxHits - DEFAULT_MATRIX.starvationMaxHits);

/** Fewest misclassified cases wins; ties go to the candidate nearest the current defaults. */
export const calibrateMatrix = (cases: readonly LabelledCrawlCase[] = FIXTURE_CASES): MatrixCalibration => {
  const candidates = range(30, 60, 5).flatMap((wasteMaxTrs) => range(5, 50, 5).flatMap((wasteMinHits) => range(1, 5, 1).map((starvationMaxHits) => {
    const thresholds = { wasteMaxTrs, wasteMinHits, starvationMaxHits };
    return { ...thresholds, errors: cases.filter((item) => classifyCrawl(item.trs, item.hits, thresholds) !== item.verdict).length, cases: cases.length };
  })));
  return candidates.reduce((best, item) => (item.errors < best.errors || (item.errors === best.errors && distance(item) < distance(best)) ? item : best));
};
