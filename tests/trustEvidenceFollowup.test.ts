import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mapClaimsToCitations } from '@/services/citationEvidence/claims';
import { buildTrustReport } from '@/services/eeatTrust/build';
import { classifyProfile, declarationRecall } from '@/services/eeatTrust/identifiers';
import { hasVerifiedTrustEvidence, readTrustHistory, recordTrust, trustHistoryKey } from '@/services/eeatTrust/history';
import { clearRegistryCache, verifyProfile } from '@/services/eeatTrust/registry';
import type { TrustReport } from '@/services/eeatTrust/types';
import { diabetesFocus, diabetesPages, node, trustedArticle } from './eeatTrustFixtures';

const ORCID = 'https://orcid.org/0000-0002-1825-0097';

const trustedPagesWithValidOrcid = () => diabetesPages().map((page) => {
  if (!page.url.includes('/articles/')) return page;
  const article = trustedArticle(page);
  return {
    ...article,
    schema_references: (article.schema_references ?? []).map((reference) => reference.property === 'sameAs'
      ? { ...reference, value: ORCID }
      : reference),
  };
});

describe('trust evidence follow-up contracts', () => {
  beforeEach(() => {
    localStorage.clear();
    clearRegistryCache();
  });

  it('keeps citation evidence tri-state and makes mixed known values explicit', () => {
    const unknown = mapClaimsToCitations('Badania wykazały wzrost ryzyka o 20% (doi:10.1000/test).', [
      { key: 'doi:10.1000/test' },
    ])[0];
    expect(unknown).toMatchObject({ sourceExists: null, reachable: null, topical: null, supportsClaim: null, sourceChecked: false });

    const mixed = mapClaimsToCitations('Badania wykazały wzrost ryzyka o 20% (PMCID PMC12345; PMID 12345).', [
      { key: 'pmcid:PMC12345', exists: false, reachable: false, topical: false },
      { key: 'pmid:12345', exists: true, reachable: true, topical: true },
    ])[0];
    expect(mixed).toMatchObject({ sourceExists: true, reachable: true, topical: true, supportsClaim: null, sourceChecked: false });
  });

  it('retains the declaration signal after a fetch state transition', () => {
    const syntax = classifyProfile(ORCID);
    const recall = declarationRecall([syntax]);
    for (const status of ['fetched', 'verified', 'unavailable'] as const) {
      expect(declarationRecall([{ ...syntax, status }])).toBe(recall);
    }
    expect(declarationRecall([{ ...syntax, status: 'mismatch' }])).toBe(0);
    expect(declarationRecall([{ ...syntax, status: 'invalid' }])).toBe(0);
  });

  it('does not lower sameAs after verification and exposes verified coverage', () => {
    const pages = trustedPagesWithValidOrcid();
    const focus = diabetesFocus(pages);
    const baseline = buildTrustReport(pages, focus, { now: '2026-10-27T00:00:00Z' });
    const verified = buildTrustReport(pages, focus, {
      now: '2026-10-27T00:00:00Z',
      profileEvidence: { [ORCID]: { url: ORCID, kind: 'orcid', tier: 1, id: '0000-0000-0000-0001', status: 'verified' } },
    });
    expect(verified.layers.sameAs).toBe(baseline.layers.sameAs);
    expect(verified.coverage.sameAs?.verified).toBe(100);
    expect(verified.authors[0].reconciliation?.status).toBe('verified');
  });

  it('surfaces mismatch/invalid warnings before a positive profile status', () => {
    const wikidata = 'https://www.wikidata.org/wiki/Q1';
    const pages = diabetesPages().map((page) => {
      if (!page.url.includes('/articles/')) return page;
      const article = trustedArticle(page);
      return {
        ...article,
        schema_references: [
          ...(article.schema_references ?? []).map((reference) => reference.property === 'sameAs' ? { ...reference, value: ORCID } : reference),
          ...node('$.@graph[1]', { props: [['sameAs', wikidata]] }, 1),
        ],
      };
    });
    const report = buildTrustReport(pages, diabetesFocus(pages), {
      profileEvidence: {
        [ORCID]: { url: ORCID, kind: 'orcid', tier: 1, id: '0000-0000-0000-0001', status: 'verified' },
        [wikidata]: { url: wikidata, kind: 'wikidata', tier: 1, id: 'Q1', status: 'mismatch' },
      },
    });
    expect(report.authors[0].reconciliation?.status).toBe('mismatch');
  });

  it('preserves a verified run snapshot when a later remount has no evidence', () => {
    const empty = buildTrustReport([], undefined, { now: '2026-10-27T00:00:00Z' });
    const report: TrustReport = {
      ...empty,
      generatedAt: '2026-10-27T00:00:00Z', score: 80, layers: { sameAs: 80 },
      coverage: { ...empty.coverage, sameAs: { observed: 100, declared: 100, verified: 100, unknown: 0 } },
    };
    const weaker: TrustReport = {
      ...report,
      generatedAt: '2026-10-27T01:00:00Z', score: 20, layers: { sameAs: 20 },
      coverage: { ...report.coverage, sameAs: { observed: 100, declared: 100, verified: 0, unknown: 0 } },
    };
    expect(hasVerifiedTrustEvidence(report)).toBe(true);
    recordTrust('trust-followup-project', report, 'run-1');
    const history = recordTrust('trust-followup-project', weaker, 'run-1');
    expect(history).toHaveLength(1);
    expect(history[0].score).toBe(80);
    expect(readTrustHistory('trust-followup-project')[0].score).toBe(80);
    expect(localStorage.getItem(trustHistoryKey('trust-followup-project'))).toContain('"verified":100');
  });

  it('does not reuse a registry result across matcher or run scope', async () => {
    const fetcher = vi.fn(async (url: string) => ({ status: 200, url, body: '{}' }));
    const profile = classifyProfile(ORCID);
    const first = { fetcher, projectId: 'p1', runId: 'r1', matches: () => true, now: () => '2026-10-27T00:00:00Z' };
    const second = { fetcher, projectId: 'p1', runId: 'r1', matches: () => false, now: () => '2026-10-27T00:00:00Z' };
    const third = { fetcher, projectId: 'p1', runId: 'r2', matches: () => true, now: () => '2026-10-27T00:00:00Z' };
    expect((await verifyProfile(profile, first)).profile.status).toBe('verified');
    expect((await verifyProfile(profile, second)).profile.status).toBe('mismatch');
    expect((await verifyProfile(profile, third)).profile.status).toBe('verified');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
