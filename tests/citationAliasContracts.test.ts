import { describe, expect, it } from 'vitest';
import { citationAliases } from '@/services/citationEvidence/aliases';
import { matchAiCitationToCrawl } from '@/services/aiCitationEvidence';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';

const page = (url: string, extra: Partial<CrawledPageSummary> = {}) => ({ url, ...extra }) as CrawledPageSummary;

describe('citation URL ownership', () => {
  it('retains chain-specific match kinds while request and final identities take priority', () => {
    const pages = [page('https://site.test/request', { final_url: 'https://site.test/final', redirect_chain: [
      { from_url: 'https://site.test/middle', to_url: 'https://site.test/end', http_status: 301 },
      { from_url: 'https://site.test/request', to_url: 'https://site.test/final', http_status: 302 },
    ] })];
    const aliases = citationAliases(pages);
    expect(aliases.get(pages[0].url)).toEqual({ page: pages[0], matchKind: 'request_url' });
    expect(aliases.get('https://site.test/final')?.matchKind).toBe('final_url');
    expect(aliases.get('https://site.test/middle')?.matchKind).toBe('redirect_from');
    expect(aliases.get('https://site.test/end')?.matchKind).toBe('redirect_to');
  });

  it('ignores invalid identities and rejects duplicate exact requests', () => {
    const aliases = citationAliases([page('https://site.test/a'), page('https://site.test/a'), page('bad'),
      page('https://site.test/b', { final_url: 'ftp://site.test/final' })]);
    expect([...aliases.keys()]).toEqual(['https://site.test/b']);
    expect(citationAliases([]).size).toBe(0);
  });

  it('returns unavailable evidence for malformed snapshots and unobserved valid URLs', () => {
    const malformed = { result: { pages: null } } as unknown as CrawlRunRecord;
    expect(matchAiCitationToCrawl('https://site.test/a', malformed).matched).toBe(false);
    const run = { result: { pages: [page('https://site.test/a')] } } as unknown as CrawlRunRecord;
    expect(matchAiCitationToCrawl('https://site.test/b', run).matched).toBe(false);
    expect(matchAiCitationToCrawl('https://!', run).matched).toBe(false);
  });
});
