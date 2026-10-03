import type { DomainOverviewData } from '@/types';

export const domainOverviewFixture = (domain = 'example.com'): DomainOverviewData => ({
  domain, organic_traffic: 0, organic_keywords: null, domain_rank: null, referring_domains: 0,
  top_keywords: [], top_pages: [], competitors: [],
});
