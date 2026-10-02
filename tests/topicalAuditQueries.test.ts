import { describe, expect, it } from 'vitest';
import { auditQueryEvidence } from '@/services/topicalAudit/queries';
import { page, topic } from './fixtures/semanticAuditContracts';
import { auditContext } from './fixtures/topicalAuditContext';
import type { TopicalQuery } from '@/services/topicalMap';

const sourcedQuery = (searchIntent: string | null, retrievedAt: string | undefined = '2026-10-02'): TopicalQuery => ({
  id: 'provider-query', text: 'coffee beans', provenance: 'dataforseo',
  source: {
    provider: 'DataForSEO Google Ads Keywords for Keywords Live', retrievedAt,
    seedKeyword: 'coffee', countryCode: 'PL', locationCode: 2616, languageCode: 'pl',
    searchVolume: 10, cpc: null, competitionIndex: null, searchIntent, monthlySearches: [],
  } as TopicalQuery['source'],
});

describe('query declarations and provider intent evidence', () => {
  it('reports zero and partial coverage while retaining missing-term evidence', () => {
    const pages = [page('https://site.test/partial', ['coffee']),
      { ...page('https://site.test/missing', []), semantic_terms: undefined }];
    const node = topic(pages.map((entry) => entry.url), [
      { id: 'query', text: 'coffee beans', provenance: 'asserted' },
      { id: 'blank', text: 'a 12', provenance: 'asserted' },
    ]);
    const context = auditContext(pages, [node]);
    auditQueryEvidence(context);
    expect(context.findings.map((finding) => finding.code)).toEqual(['query-not-observed', 'query-not-observed']);
    expect(context.findings.map((finding) => finding.detail)).toEqual([expect.stringContaining('1/2'), expect.stringContaining('0/2')]);
    expect(context.findings[1]).toMatchObject({ confidence: 'limited', provenance: ['asserted', 'measured', 'derived'] });
  });

  it('skips complete query coverage and unspecified editorial intent', () => {
    for (const intent of ['unknown', 'mixed'] as const) {
      const context = auditContext([page('https://site.test/a', ['coffee', 'beans'])], [{
        ...topic(['https://site.test/a'], [sourcedQuery('transactional')]), intent,
      }]);
      auditQueryEvidence(context);
      expect(context.findings).toEqual([]);
    }
  });

  it('does not infer a mismatch from missing, unknown, or matching provider intent', () => {
    const queries = [sourcedQuery('informational'), { ...sourcedQuery('unknown'), id: 'unknown' },
      { id: 'asserted', text: 'coffee', provenance: 'asserted' as const },
      { ...sourcedQuery(null), id: 'null' }, { ...sourcedQuery('noncommercial'), id: 'negative' },
      { ...sourcedQuery('commercial / transactional'), id: 'compound' }];
    const context = auditContext([], [topic([], queries)]);
    auditQueryEvidence(context);
    expect(context.findings).toEqual([]);
  });

  it('retains a qualified mismatch even when the query has no mapped pages or timestamp', () => {
    const context = auditContext([], [topic([], [sourcedQuery('transactional', undefined)])]);
    // Explicitly model legacy provider metadata without a retrieval timestamp.
    const legacySource = context.document.nodes[0].queries[0].source as unknown as { retrievedAt?: string };
    delete legacySource.retrievedAt;
    context.pagesByTopic.clear();
    auditQueryEvidence(context);
    expect(context.findings).toEqual([expect.objectContaining({
      code: 'query-intent-mismatch', urls: [], topicId: 'topic-coffee', severity: 'review', confidence: 'moderate',
    })]);
    expect(context.document.nodes[0].intent).toBe('informational');
  });
});
