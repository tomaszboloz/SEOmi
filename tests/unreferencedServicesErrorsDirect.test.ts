import { describe, expect, it, vi } from 'vitest';
import { ModelListError } from '@/services/ai/modelList';
import { DataForSeoBudgetError } from '@/services/dataforseo/dataforseoBudgetGuard';
import { getDomainOverview } from '@/services/dataforseo/dataforseoDomain';
import { getKeywordIdeas } from '@/services/dataforseo/dataforseoKeywords';
import { getSerpCompetitors } from '@/services/dataforseo/dataforseoSerp';
import type { DataForSEOCore } from '@/services/dataforseo/dataforseoCore';

describe('unreferenced services and errors direct assertions', () => {
  it('ModelListError sets HTTP status and formatted message', () => {
    const error = new ModelListError(404);
    expect(error.status).toBe(404);
    expect(error.message).toContain('HTTP 404');
    expect(error).toBeInstanceOf(Error);
  });

  it('DataForSeoBudgetError stores spentUsd and limitUsd properties', () => {
    const error = new DataForSeoBudgetError('Limit exceeded', 50.0, 40.0);
    expect(error.name).toBe('DataForSeoBudgetError');
    expect(error.spentUsd).toBe(50.0);
    expect(error.limitUsd).toBe(40.0);
    expect(error.message).toBe('Limit exceeded');
  });

  it('getDomainOverview returns parsed domain data from client responses', async () => {
    const mockClient = {
      post: vi.fn().mockImplementation((endpoint: string) => {
        if (endpoint.includes('domain_rank_overview')) {
          return Promise.resolve([{ items: [{ metrics: { organic: { etv: 1250, count: 42 } } }] }]);
        }
        return Promise.resolve([{ items: [] }]);
      }),
    } as unknown as DataForSEOCore;

    const result = await getDomainOverview(mockClient, 'example.com', 2840, 'en');
    expect(result).not.toBeNull();
    expect(result?.domain).toBe('example.com');
    expect(result?.organic_traffic).toBe(1250);
    expect(result?.organic_keywords).toBe(42);
    expect(mockClient.post).toHaveBeenCalledWith(
      '/v3/dataforseo_labs/google/domain_rank_overview/live',
      [{ target: 'example.com', location_code: 2840, language_code: 'en' }],
    );
    expect(mockClient.post).toHaveBeenCalledWith(
      '/v3/backlinks/summary/live',
      [{ target: 'example.com', internal_list_limit: 1000 }],
    );
  });

  it('getKeywordIdeas maps keyword rows into KeywordIdea array', async () => {
    const mockClient = {
      post: vi.fn().mockResolvedValue([
        {
          items: [
            {
              keyword: 'seo audit',
              search_volume: 1000,
              cpc: 2.5,
              competition: 0.5,
              search_intent_info: { main_intent: 'informational' },
              monthly_searches: [],
            },
          ],
        },
      ]),
    } as unknown as DataForSEOCore;

    const ideas = await getKeywordIdeas(mockClient, 'seo', 2840, 'en');
    expect(ideas).toHaveLength(1);
    expect(ideas[0].keyword).toBe('seo audit');
    expect(mockClient.post).toHaveBeenCalledWith(
      '/v3/keywords_data/google_ads/keywords_for_keywords/live',
      [{ keywords: ['seo'], location_code: 2840, language_code: 'en' }],
    );
  });

  it('getSerpCompetitors parses organic SERP items', async () => {
    const mockClient = {
      post: vi.fn().mockResolvedValue([
        {
          items: [
            {
              type: 'organic',
              rank_group: 1,
              rank_absolute: 1,
              domain: 'example.com',
              title: 'Example Domain',
              description: 'Official site',
              url: 'https://example.com/',
            },
          ],
        },
      ]),
    } as unknown as DataForSEOCore;

    const serp = await getSerpCompetitors(mockClient, 'example', 2840, 'en');
    expect(serp).toHaveLength(1);
    expect(serp[0].domain).toBe('example.com');
    expect(serp[0].rank_absolute).toBe(1);
    expect(mockClient.post).toHaveBeenCalledWith(
      '/v3/serp/google/organic/live/regular',
      [{ keyword: 'example', location_code: 2840, language_code: 'en', depth: 100 }],
      [],
    );
  });
});
