import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@/i18n';
import { AuthorityHistoryChart } from '@/components/Domain/crawlResults/authority/AuthorityHistoryChart';
import { AuthorityPillars } from '@/components/Domain/crawlResults/authority/AuthorityPillars';
import { buildAuthorityReport, type TopicalAuthorityReport } from '@/services/topicalAuthority';
import { depthInputs } from '@/services/topicalAuthority/depth';
import { annotateAuthority, authorityProfile, makeAuthoritySnapshot, type AuthorityHistoryEntry } from '@/services/topicalAuthorityMonitoring/history';
import { NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const START = `https://${OWN_HOST}/`;
const build = (taxonomy = referenceTaxonomy(ownSite())): TopicalAuthorityReport => { const pages = ownSite(); return buildAuthorityReport(pages, START, ownReport(pages), { taxonomy, now: NOW }); };

describe('CDES inputs are explicit (#58 GEM-58-04)', () => {
  it('summarizes complete, partial and unavailable depth inputs', () => {
    const all = ['entities', 'questions', 'gain'] as const;
    expect(depthInputs([])).toEqual({ status: 'unavailable', rows: 0, measured: { entities: 0, questions: 0, gain: 0 }, missing: [] });
    expect(depthInputs([{ coverage: 1, depth: 70, depthParts: [...all] }, { coverage: 0, depth: 10 }])).toMatchObject({ status: 'complete', rows: 1 });
    const partial = depthInputs([{ coverage: 1, depth: 70, depthParts: [...all] }, { coverage: 0.5, depth: 40, depthParts: ['entities', 'gain'] }, { coverage: 1 }]);
    expect(partial).toEqual({ status: 'partial', rows: 2, measured: { entities: 2, questions: 1, gain: 2 }, missing: ['questions'] });
  });

  it('is attached to the report and shown as partial in the pillar card', () => {
    const report = build();
    expect(report.depthInputs).toBeDefined();
    expect(report.coverage.filter((row) => row.coverage > 0).every((row) => Array.isArray(row.depthParts))).toBe(true);
    const partial = { ...report, depthInputs: { status: 'partial' as const, rows: 3, measured: { entities: 3, questions: 0, gain: 3 }, missing: ['questions' as const] } };
    const view = render(<AuthorityPillars report={partial} />);
    expect(screen.getByText(/user questions \(PAA\) could not be measured for some of the 3/)).toBeTruthy();
    view.rerender(<AuthorityPillars report={{ ...report, depthInputs: { ...partial.depthInputs, status: 'complete', missing: [] } }} />);
    expect(screen.queryByText(/could not be measured/)).toBeNull();
  });
});

describe('scoring profile in history (#58, #61 GEM-61-04)', () => {
  it('fingerprints TAS version and reference map identity', () => {
    const report = build();
    const profile = authorityProfile(report);
    expect(profile).toContain(`tas${report.version}`);
    expect(authorityProfile({ ...report, taxonomy: { ...report.taxonomy!, market: { country: 'PL', language: 'pl' } } })).toContain('PL-pl');
    expect(authorityProfile({ ...report, taxonomy: null })).toBe(`tas${report.version}|no-map`);
    expect(makeAuthoritySnapshot(report, 'r1').profile).toBe(profile);
  });

  it('flags a profile change but never guesses for old snapshots', () => {
    const base = makeAuthoritySnapshot(build(), 'r1');
    const rebuilt = { ...base, runId: 'r2', profile: `${base.profile}-new` };
    expect(annotateAuthority(base, rebuilt).map((note) => note.code)).toContain('incomparable');
    expect(annotateAuthority(base, { ...base, runId: 'r2' }).map((note) => note.code)).not.toContain('incomparable');
    const legacy = { ...base, profile: undefined };
    expect(annotateAuthority(legacy, rebuilt).map((note) => note.code)).not.toContain('incomparable');
  });

  it('breaks the TAS line and lists the incomparability milestone without changing saved points', () => {
    const snap = makeAuthoritySnapshot(build(), 'r1');
    const entries: AuthorityHistoryEntry[] = [
      { snapshot: { ...snap, runId: 'a', tas: 40 }, annotations: [] },
      { snapshot: { ...snap, runId: 'b', tas: 45 }, annotations: [] },
      { snapshot: { ...snap, runId: 'c', tas: 60 }, annotations: [{ code: 'incomparable', params: {} }] },
      { snapshot: { ...snap, runId: 'd', tas: 62 }, annotations: [] },
    ];
    const { container } = render(<AuthorityHistoryChart entries={entries} />);
    expect(container.querySelectorAll('polyline[stroke-dasharray="5 4"]')).toHaveLength(2);
    expect(screen.getAllByTestId('authority-history-break')).toHaveLength(1);
    expect(screen.getByText(/Scoring profile changed/)).toBeTruthy();
    expect(entries[2].snapshot.tas).toBe(60);
  });
});
