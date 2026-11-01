import { beforeEach, describe, expect, it } from 'vitest';
import { computeHss, hssInputsFromReports, meanModuleInput, sprsModuleInput } from '@/services/hss';
import { latestIgosScores, latestSijaScores } from '@/services/hss/historyScores';
import type { IgosHistoryEntry } from '@/services/igos/history';
import type { SprsReport } from '@/services/semanticGraph/sprs';
import { writeJsonStorage } from '@/services/storage';

const page = (nodeId: string, flags: Partial<SprsReport['pages'][number]> = {}) => ({ nodeId, score: 50, probability: 0.1, inDegree: 1, outDegree: 1, deadEnd: false, underLinked: false, leak: false, ...flags });
const sprs = (patch: Partial<SprsReport> = {}): SprsReport => ({ status: 'ready', pages: [page('a'), page('b'), page('c', { leak: true }), page('d', { underLinked: true })], converged: true, iterations: 3, residual: 0, unknownSimilarityEdges: 0, unweightedZoneLinks: 0, ...patch });
const igos = (runAt: string, model: string, value: number | null): IgosHistoryEntry => ({ runAt, targetUrl: 'u', provider: 'local', model, igos: value, status: 'ready', availableDocs: 3, requestedDocs: 3, docUrls: [] });

describe('site-level scalars for per-page modules (#72 GEM-72-D01/D02)', () => {
  it('averages measured scores, skips nulls, needs 3', () => {
    expect(meanModuleInput('igos', [60, null, 70, 80], 'r')).toEqual({ module: 'igos', value: 70, runId: 'r' });
    expect(meanModuleInput('sija', [60, null, 70], 'r')).toMatchObject({ value: null, reason: 'insufficient-pages' });
    expect(meanModuleInput('sija', [1, 2, Number.NaN], 'r').value).toBeNull();
    expect(meanModuleInput('igos', undefined, 'r')).toMatchObject({ value: null, reason: 'not-run' });
  });

  it('SPRS is the share of pages that are neither leaking nor under-linked', () => {
    expect(sprsModuleInput(sprs(), 'r')).toEqual({ module: 'sprs', value: 50, runId: 'r' });
    expect(sprsModuleInput(null, 'r').reason).toBe('not-run');
    expect(sprsModuleInput(sprs({ status: 'unavailable' }), 'r').reason).toBe('sprs-unavailable');
    expect(sprsModuleInput(sprs({ pages: [page('a')] }), 'r').reason).toBe('insufficient-pages');
    expect(sprsModuleInput(sprs({ converged: false }), 'r').reason).toBe('sprs-not-converged');
  });

  it('feeds HSS: measured zero stays zero and renormalisation includes the new modules', () => {
    const inputs = hssInputsFromReports({ runId: 'r', sprs: sprs({ pages: [page('a', { leak: true }), page('b', { leak: true }), page('c', { leak: true })] }), igosScores: [10, 20, 30], sijaScores: [] });
    const values = Object.fromEntries(inputs.map((input) => [input.module, input.value]));
    expect(values).toMatchObject({ sprs: 0, igos: 20, sija: null });
    expect(computeHss(inputs, 'r').measuredCount).toBe(2);
  });
});

describe('latest per-phrase scores from project history', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the newest run per phrase and only the newest model for IGOS', () => {
    writeJsonStorage('seomi_project_p_igos_history_v1', {
      a: [igos('2026-01-03', 'm2', 50), igos('2026-01-01', 'm1', 10)],
      b: [igos('2026-01-02', 'm2', 70)],
      c: [igos('2026-01-02', 'm1', 99)],
      d: [],
    });
    expect(latestIgosScores('p')).toEqual([50, 70]);
    expect(latestIgosScores(null)).toEqual([]);
    expect(latestIgosScores('empty')).toEqual([]);
  });

  it('reads the latest SSAS per phrase and keeps inconclusive runs as null', () => {
    const entry = (ssas: number | null) => ({ runAt: '2026-01-01', intent: null, serpIntent: null, ssas, analysed: 3, requested: 3 });
    writeJsonStorage('seomi_project_p_sija_history_v1', { a: [entry(80)], b: [entry(null)], c: [] });
    expect(latestSijaScores('p')).toEqual([80, null]);
    expect(latestSijaScores(undefined)).toEqual([]);
  });
});
