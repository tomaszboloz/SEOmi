import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());
vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: send }));

import { defaultMonitoringAlertSettings, readMonitoringHistory, saveMonitoringSettings, validAlert } from '@/services/monitoringAlerts';
import { buildAuthorityReport, type TopicalAuthorityReport } from '@/services/topicalAuthority';
import {
  annotateAuthority, appendAuthorityHistory, authorityAlertEvents, clearTaxonomy, competitorExpansion, contentDecay, evaluateAuthorityAlert,
  freshCannibalization, makeAuthoritySnapshot, readAuthorityHistory, readTaxonomy, readTopicalBenchmark, recordAuthority, writeTaxonomy, writeTopicalBenchmark,
  TAXONOMY_TTL_DAYS, type AuthoritySnapshot,
} from '@/services/topicalAuthorityMonitoring';
import type { TopicalBenchmark } from '@/services/topicalAuthorityReference';
import { NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const START = `https://${OWN_HOST}/`;
const PROJECT = 'proj-1';
const build = (): TopicalAuthorityReport => { const pages = ownSite(); return buildAuthorityReport(pages, START, ownReport(pages), { taxonomy: referenceTaxonomy(pages), now: NOW }); };
const snap = (patch: Partial<AuthoritySnapshot> = {}): AuthoritySnapshot => ({ runId: 'r', at: NOW, sfs: 80, tas: 60, tcr: 50, cdes: 50, silc: 50, cvff: 50, index: 10, quadrant: 'diluted_giant', pageCount: 5, pillars: {}, ...patch });
const bench = (value: number): TopicalBenchmark => ({ builtAt: NOW, source: 's', rows: [], ownRank: 1, insights: [], pillars: [{ id: 'p', label: 'Pour', own: 10, competitors: { 'a.test': value } }] });

beforeEach(() => { localStorage.clear(); send.mockReset(); send.mockResolvedValue(true); });

describe('stores', () => {
  it('keeps the reference map for 30 days and rejects malformed data', () => {
    const taxonomy = referenceTaxonomy()!;
    expect(writeTaxonomy(PROJECT, taxonomy)).toBe(true);
    expect(readTaxonomy(PROJECT, Date.parse(NOW))?.coreLabel).toBe(taxonomy.coreLabel);
    expect(readTaxonomy(PROJECT, Date.parse(NOW) + (TAXONOMY_TTL_DAYS + 1) * 86_400_000)).toBeNull();
    expect(readTaxonomy(PROJECT, Date.parse(NOW) - 1)?.version).toBe(1);
    expect(readTaxonomy('../bad')).toBeNull();
    expect(writeTaxonomy('../bad', taxonomy)).toBe(false);
    localStorage.setItem(`seomi_project_${PROJECT}_authority_taxonomy_v1`, JSON.stringify({ version: 99 }));
    expect(readTaxonomy(PROJECT)).toBeNull();
    localStorage.setItem(`seomi_project_${PROJECT}_authority_taxonomy_v1`, JSON.stringify({ ...taxonomy, builtAt: 'nonsense' }));
    expect(readTaxonomy(PROJECT)).toBeNull();
    writeTaxonomy(PROJECT, taxonomy);
    expect(clearTaxonomy(PROJECT)).toBe(true);
    expect(readTaxonomy(PROJECT, Date.parse(NOW))).toBeNull();
    expect(clearTaxonomy('../bad')).toBe(false);
  });

  it('stores the latest benchmark per project', () => {
    expect(readTopicalBenchmark(PROJECT)).toBeNull();
    expect(writeTopicalBenchmark(PROJECT, bench(5))).toBe(true);
    expect(readTopicalBenchmark(PROJECT)?.pillars[0].label).toBe('Pour');
    expect(writeTopicalBenchmark('../bad', bench(5))).toBe(false);
    expect(readTopicalBenchmark('../bad')).toBeNull();
    localStorage.setItem(`seomi_project_${PROJECT}_authority_benchmark_v1`, '{"x":1}');
    expect(readTopicalBenchmark(PROJECT)).toBeNull();
  });
});

describe('history', () => {
  it('snapshots a report, dedupes by run and tolerates corrupt entries', () => {
    const snapshot = makeAuthoritySnapshot(build(), 'run-1');
    expect(snapshot).toMatchObject({ runId: 'run-1', sfs: expect.any(Number), tas: expect.any(Number) });
    expect(Object.keys(snapshot.pillars).length).toBeGreaterThan(0);
    expect(appendAuthorityHistory(PROJECT, { snapshot, annotations: [] }).saved).toBe(true);
    expect(appendAuthorityHistory(PROJECT, { snapshot, annotations: [] }).saved).toBe(false);
    expect(readAuthorityHistory(PROJECT)).toHaveLength(1);
    localStorage.setItem(`seomi_project_${PROJECT}_authority_history_v1`, JSON.stringify([{ nope: 1 }, { snapshot: { runId: 1 }, annotations: [] }, 'x']));
    expect(readAuthorityHistory(PROJECT)).toEqual([]);
    localStorage.setItem(`seomi_project_${PROJECT}_authority_history_v1`, '{"a":1}');
    expect(readAuthorityHistory(PROJECT)).toEqual([]);
    expect(readAuthorityHistory('../bad')).toEqual([]);
  });

  it('annotates cleanup, architecture, expansion and regression', () => {
    expect(annotateAuthority(snap(), snap())).toEqual([]);
    expect(annotateAuthority(snap({ sfs: 60 }), snap({ sfs: 70 }))).toEqual([{ code: 'cleanup', params: { delta: 10 } }]);
    expect(annotateAuthority(snap({ silc: 40 }), snap({ silc: 50 }))[0].code).toBe('architecture');
    expect(annotateAuthority(snap({ index: 20 }), snap({ index: 5 }))[0]).toEqual({ code: 'architecture', params: { delta: 15 } });
    expect(annotateAuthority(snap({ tcr: 20 }), snap({ tcr: 40 }))[0].code).toBe('expansion');
    expect(annotateAuthority(snap({ tas: 70 }), snap({ tas: 60 }))[0]).toEqual({ code: 'regression', params: { delta: -10 } });
    expect(annotateAuthority(snap({ tas: null, tcr: null }), snap({ tas: 60, tcr: 80 }))).toEqual([]);
  });
});

describe('alerts', () => {
  it('flags TAS drops, fresh cannibalization, competitor expansion and content decay', () => {
    const report = build();
    expect(authorityAlertEvents({ next: snap(), report, fresh: new Set() }).filter((event) => event.code === 'tas-drop')).toEqual([]);
    const dropped = authorityAlertEvents({ previous: snap({ tas: 70 }), next: snap({ tas: 60 }), report, fresh: new Set() });
    expect(dropped[0]).toEqual({ code: 'tas-drop', params: { from: 70, to: 60, points: 10 } });
    expect(authorityAlertEvents({ previous: snap({ tas: 63 }), next: snap({ tas: 60 }), report, fresh: new Set() }).some((event) => event.code === 'tas-drop')).toBe(false);
    expect(authorityAlertEvents({ previous: snap({ tas: null }), next: snap({ tas: 10 }), report, fresh: new Set() })).toEqual(expect.not.arrayContaining([expect.objectContaining({ code: 'tas-drop' })]));
    const group = report.cannibalization[0];
    expect(freshCannibalization(report, new Set([group.urls[1]]))).toEqual([{ code: 'cannibalization', params: { url: group.urls[1], canonical: group.canonical, similarity: group.similarity } }]);
    expect(freshCannibalization(report, new Set())).toEqual([]);
    expect(competitorExpansion(bench(10), bench(40))).toEqual([{ code: 'competitor-expansion', params: { domain: 'a.test', pillar: 'Pour', from: 10, to: 40 } }]);
    expect(competitorExpansion(bench(10), bench(20))).toEqual([]);
    expect(competitorExpansion(null, bench(20))).toEqual([]);
    expect(competitorExpansion({ ...bench(10), pillars: [] }, bench(90))).toEqual([]);
    const decayed = { ...report, silo: { ...report.silo, audits: { ...report.silo.audits, [`https://${OWN_HOST}/espresso/machine-review`]: { pillarUrl: `https://${OWN_HOST}/espresso/machine-review`, linksToPillar: true, inbound: 2, bleedTargets: [] } } } };
    expect(contentDecay(decayed).some((event) => event.code === 'content-decay')).toBe(true);
    expect(contentDecay({ ...decayed, coverage: [] })).toEqual([]);
  });

  it('combines events into one valid localized alert', () => {
    expect(evaluateAuthorityAlert([], 'x')).toBeNull();
    const alert = evaluateAuthorityAlert([
      { code: 'tas-drop', params: { from: 70, to: 60, points: 10 } },
      { code: 'cannibalization', params: { url: 'u1', canonical: 'c', similarity: 90 } },
      { code: 'competitor-expansion', params: { domain: 'a.test', pillar: 'Pour', from: 10, to: 40 } },
      { code: 'content-decay', params: { url: 'u2', missing: 3 } },
    ], 'authority:r1');
    expect(alert?.type).toBe('focus');
    expect(alert?.body).toContain('fell by 10 points');
    expect(alert?.body).toContain('a.test');
    expect(validAlert(alert)).toBe(true);
    expect(alert?.evidence['content-decay']).toBe('u2');
  });
});

describe('recording a full analysis', () => {
  it('stores one snapshot per run, annotates changes and notifies when enabled', async () => {
    saveMonitoringSettings(PROJECT, { ...defaultMonitoringAlertSettings(), enabled: true, frequency: 'run' });
    const report = build();
    const urls = ownSite().map((page) => page.url);
    const first = recordAuthority(PROJECT, report, 'run-1', urls, { benchmark: bench(10), notify: false });
    expect(first.saved).toBe(true);
    expect(first.events.filter((event) => event.code !== 'content-decay')).toEqual([]);
    expect(readTopicalBenchmark(PROJECT)?.pillars[0].competitors['a.test']).toBe(10);
    expect(recordAuthority(PROJECT, report, 'run-1', urls).saved).toBe(false);
    const worse = { ...report, tas: (report.tas as number) - 20, generatedAt: '2026-10-02T00:00:00.000Z' };
    const second = recordAuthority(PROJECT, worse, 'run-2', urls, { benchmark: bench(60), clock: () => Date.parse(NOW) });
    expect(second.previous?.runId).toBe('run-1');
    expect(second.events.map((event) => event.code)).toEqual(expect.arrayContaining(['tas-drop', 'competitor-expansion']));
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
    await vi.waitFor(() => expect(readMonitoringHistory(PROJECT)[0]?.type).toBe('focus'));
    expect(readAuthorityHistory(PROJECT)).toHaveLength(2);
  });
});
