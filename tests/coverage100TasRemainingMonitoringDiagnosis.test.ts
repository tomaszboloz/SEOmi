import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import { buildTopicalBenchmark, type ReferenceInput } from '@/services/topicalAuthorityReference';
import { authorityAlertEvents, competitorExpansion, evaluateAuthorityAlert } from '@/services/topicalAuthorityMonitoring/alerts';
import { buildTopics } from '@/services/topicalDiagnosis/topics';
import type { DiagnosisDocument } from '@/services/topicalDiagnosis/types';
import { defaultReferenceRunner, useTopicalAuthority } from '@/hooks/useTopicalAuthority';
import { COMPETITORS, NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

vi.mock('@/services/topicalAuthorityReference', async () => {
  const actual = await vi.importActual<typeof import('@/services/topicalAuthorityReference')>('@/services/topicalAuthorityReference');
  return { ...actual, createReferenceDeps: vi.fn(() => ({})), runReference: vi.fn(async () => ({ status: 'cancelled' as const })) };
});

const benchmark = (competitors: Record<string, number>) => ({ pillars: [{ id: 'p', label: 'P', own: 0, competitors }], builtAt: NOW, source: 'test', rows: [], ownRank: 1, insights: [] } as never);
const diagnosisDoc = (id: string, term: string): DiagnosisDocument => ({
  id, pages: [], primaryPage: { url: `https://x.test/${id}` }, urls: new Set([`https://x.test/${id}`]), languages: ['en'],
  terms: term ? new Set(term.split(' ')) : new Set(), titleTerms: term ? new Set(term.split(' ')) : new Set(), titleForms: new Map(), section: 'x', role: 'content', partialEvidence: false,
});

describe('coverage100 TAS monitoring, reference and diagnosis edges', () => {
  it('handles absent competitor baselines and emits only real expansions', () => {
    expect(competitorExpansion(null, benchmark({ rival: 80 }))).toEqual([]);
    expect(competitorExpansion(benchmark({}), benchmark({ rival: 80 }))).toEqual([]);
    expect(competitorExpansion(benchmark({ rival: 10 }), benchmark({ rival: 34 }))).toEqual([]);
    expect(competitorExpansion(benchmark({ rival: 10 }), benchmark({ rival: 36 }))).toMatchObject([{ code: 'competitor-expansion', params: { domain: 'rival', from: 10, to: 36 } }]);
  });

  it('keeps benchmark competitors at zero when a pillar is absent', () => {
    const pages = ownSite();
    const taxonomy = referenceTaxonomy(pages)!;
    const base = buildAuthorityReport(pages, `https://${OWN_HOST}/`, ownReport(pages), { taxonomy, now: NOW });
    const own = { ...base, pillarCoverage: [...base.pillarCoverage, { id: 'missing', label: 'Missing', subtopics: 1, coveragePct: 0, gaps: 1, shallow: 0 }] };
    const result = buildTopicalBenchmark(own, OWN_HOST, COMPETITORS.slice(0, 1), taxonomy, NOW);
    expect(result?.pillars.find((pillar) => pillar.id === 'missing')?.competitors).toEqual({ 'rival-one.test': 0 });
  });

  it('builds a hook error state for plain thrown values and exercises the default runner', async () => {
    const report = ownReport();
    await expect(defaultReferenceRunner({ report, startUrl: `https://${OWN_HOST}/` } as ReferenceInput)).resolves.toEqual({ status: 'cancelled' });
    const runner = vi.fn(async () => { throw 'plain failure'; });
    const view = renderHook(() => useTopicalAuthority({ pages: ownSite() as never, startUrl: `https://${OWN_HOST}/`, sfs: report, runner }));
    await act(async () => { await view.result.current.build(); });
    expect(view.result.current.state).toMatchObject({ running: false, error: 'plain failure' });
  });

  it('skips empty topical term sets before lexical pair construction', () => {
    const stats = { documentFrequency: new Map(), comparable: 2, isTopical: () => true, idf: () => 1 };
    const result = buildTopics([diagnosisDoc('doc-0', ''), diagnosisDoc('doc-1', 'en:alpha en:beta'), diagnosisDoc('doc-2', 'en:alpha en:beta')], new Map(), stats);
    expect(result.singletons).toContain('doc-0');
    expect(result.topics).toHaveLength(1);
  });

  it('combines authority alert sources without losing event evidence', () => {
    const report = ownReport();
    const input = {
      previous: { tas: 80 } as never, next: { tas: 20 } as never, report: {
        ...buildAuthorityReport(ownSite(), `https://${OWN_HOST}/`, report, { now: NOW }),
        freshness: { ratio: 1, dated: 1, stale: [] }, cannibalization: [],
      }, fresh: new Set<string>(), previousBenchmark: benchmark({ rival: 0 }), benchmark: benchmark({ rival: 40 }),
    } as never;
    const events = authorityAlertEvents(input);
    expect(events.map((event) => event.code)).toEqual(expect.arrayContaining(['tas-drop', 'competitor-expansion']));
    expect(evaluateAuthorityAlert(events, 'project')).toMatchObject({ type: 'focus', sourceId: 'project' });
  });
});
