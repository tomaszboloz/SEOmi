import { beforeEach, describe, expect, it } from 'vitest';
import { buildTrustReport, comparableTrustSnapshots, readTrustHistory, recordTrust, trustHistoryKey } from '@/services/eeatTrust';
import { AUTHOR_ID, diabetesFocus, diabetesPages, NOW, trustedArticle } from './eeatTrustFixtures';

describe('EETV five-layer profile', () => {
  beforeEach(() => localStorage.clear());

  it('publishes explicit profile, layers and evidence coverage', () => {
    const report = buildTrustReport(diabetesPages(), diabetesFocus(), { now: NOW });
    expect(report).toMatchObject({ profileVersion: 2, profileId: 'eetv-5-layer-v2' });
    expect(Object.keys(report.coverage)).toEqual(expect.arrayContaining(['schemaGraph', 'sameAs', 'authorAlignment', 'citationQuality', 'transparency']));
    expect(report.coverage.sameAs).toEqual(expect.objectContaining({ observed: expect.any(Number), declared: expect.any(Number), verified: 0, unknown: expect.any(Number) }));
  });

  it('keeps an empty crawl unavailable instead of reporting observed zero layers', () => {
    const report = buildTrustReport([], undefined, { now: NOW });
    expect(report).toMatchObject({ availability: 'unavailable', score: null, level: null });
    expect(recordTrust('unavailable', report, 'empty')).toEqual([]);
    expect(report.layers.schemaGraph).toBeUndefined();
    expect(report.layers.transparency).toBeUndefined();
    expect(report.coverage.schemaGraph?.unknown).toBe(100);
    expect(report.coverage.transparency?.unknown).toBe(100);
  });

  it('keeps legacy history intact and never compares profiles silently', () => {
    const old = { at: NOW, runId: 'old', score: 70, layers: { schemaGraph: 70 } };
    localStorage.setItem(trustHistoryKey('p'), JSON.stringify([old]));
    const legacy = readTrustHistory('p')[0];
    expect(legacy).toEqual(old);
    expect(comparableTrustSnapshots(legacy, { ...old, runId: 'old-2' })).toBe(true);
    const report = buildTrustReport(diabetesPages().map(trustedArticle), undefined, { now: NOW });
    const modern = recordTrust('p', report, 'new')[1];
    expect(modern.profileId).toBe('eetv-5-layer-v2');
    expect(comparableTrustSnapshots(legacy, modern)).toBe(false);
  });

  it('uses supplied registry evidence as the report default source contract', () => {
    const pages = diabetesPages().map((page) => page.url.includes('/articles/') ? trustedArticle(page) : page);
    const report = buildTrustReport(pages, diabetesFocus(pages), { profileEvidence: {
      'https://orcid.org/0000-0000-0000-0001': { url: 'https://orcid.org/0000-0000-0000-0001', kind: 'orcid', status: 'verified', tier: 1, id: '0000-0000-0000-0001' },
    } });
    expect(report.authors.find((author) => author.id === AUTHOR_ID)?.reconciliation).toMatchObject({ status: 'verified', evidence: 'registry' });
  });
});
