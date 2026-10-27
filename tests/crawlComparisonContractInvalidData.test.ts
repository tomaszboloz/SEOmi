import { describe, expect, it } from 'vitest';
import { createCrawlRunFixture } from './fixtures/crawl';
import { crawlScopeSignature, guardCrawlComparison } from '@/services/crawlComparisonContract';

describe('crawl comparison invalid persisted data', () => {
  it('fails closed without throwing when URL and completion fields are missing', () => {
    const baseline = createCrawlRunFixture({ id: 'baseline', projectId: 'project-invalid-data' });
    const malformed = createCrawlRunFixture({
      id: 'current', projectId: 'project-invalid-data', startUrl: undefined as never, completedAt: undefined as never,
      result: { ...baseline.result, start_url: undefined as never },
    });

    expect(() => guardCrawlComparison(malformed, baseline, { projectId: 'project-invalid-data' })).not.toThrow();
    const guard = guardCrawlComparison(malformed, baseline, { projectId: 'project-invalid-data' });
    expect(guard.status).toBe('blocked');
    expect(guard.reasons).toEqual(expect.arrayContaining(['different-scope', 'invalid-completion-time']));
    expect(guard.provenance.scopeMatched).toBe(false);
  });

  it('keeps scope fingerprinting safe for non-string persisted URLs', () => {
    const valid = createCrawlRunFixture({ id: 'valid', startUrl: 'https://example.test/' });
    expect(() => crawlScopeSignature({ ...valid, startUrl: 42 as never })).not.toThrow();
  });
});
