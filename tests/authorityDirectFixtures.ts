import type { AuthorityContext, AuthorityPage, SubtopicCoverage } from '@/services/topicalAuthority';
import { createCrawlPageFixture } from './fixtures/crawl';

export const authorityPage = (url: string, patch: Partial<AuthorityPage> = {}): AuthorityPage => ({
  url,
  page: createCrawlPageFixture({ url, final_url: url, links: [] }),
  focus: { trs: 80, type: 'article' } as AuthorityPage['focus'],
  vector: new Map([['topic', 1]]),
  zone: new Set(['topic']),
  h1: new Set(['topic']),
  headings: [],
  keys: new Set(['core']),
  ...patch,
});

export const authorityContext = (pages: AuthorityPage[], extra: AuthorityPage[] = []): AuthorityContext => ({
  language: 'en', pages, byUrl: new Map([...pages, ...extra].map((entry) => [entry.url, entry])), coreKeys: new Set(['core']),
});

export const authorityCoverage = (patch: Partial<SubtopicCoverage> = {}): SubtopicCoverage => ({
  subtopicId: 'topic', pillar: 'p', label: 'Topic', importance: 1, status: 'covered_strong', coverage: 1,
  urls: [], similarity: 100, entitiesPresent: [], entitiesMissing: [], questionsMissing: [], ...patch,
});
