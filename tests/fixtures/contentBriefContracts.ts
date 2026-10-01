import { type TopicalEntityFact } from '@/services/topicalMap';
import type { CrawledPageSummary } from '@/types';

export const crawled = [{ url: 'https://site.test/guide', final_url: 'https://site.test/guide' }] as unknown as CrawledPageSummary[];

export const fact = (value: string, reuseStatus: TopicalEntityFact['reuseStatus'], sourceUrl = ''): TopicalEntityFact => ({ id: value, attribute: 'claim', value, reuseStatus, sourceUrl });
