import { describe, expect, it } from 'vitest';
import { crawlAioSummary } from '@/services/aioReadiness';
import { aioRProfile } from '@/services/aioReadiness/profile';
import { GOOD_PAGE, WEAK_PAGE } from './aioFixtures';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

describe('gemini050AioPdfProfileProvenance - crawlAioSummary profile provenance', () => {
  it('returns persisted status when stored profile matches computing profile', () => {
    const current = aioRProfile();
    const run = createCrawlRunFixture({
      result: createCrawlResultFixture({
        pages: [GOOD_PAGE, WEAK_PAGE],
        aio_profile: {
          id: current.id,
          algorithmVersion: current.algorithmVersion,
          configHash: current.configHash,
          language: current.language,
          market: current.market,
        },
      }),
    });

    const summary = crawlAioSummary(run);
    expect(summary).toBeDefined();
    expect(summary?.profile_status).toBe('persisted');
    expect(summary?.profile).toEqual({
      id: current.id,
      algorithm_version: current.algorithmVersion,
      config_hash: current.configHash,
      language: current.language,
      market: current.market,
    });
    expect(summary?.historical_profile).toEqual(summary?.profile);
  });

  it('returns legacy-unversioned and current profile when no saved profile exists', () => {
    const current = aioRProfile();
    const run = createCrawlRunFixture({
      result: createCrawlResultFixture({
        pages: [GOOD_PAGE, WEAK_PAGE],
        aio_profile: undefined,
      }),
    });

    const summary = crawlAioSummary(run);
    expect(summary).toBeDefined();
    expect(summary?.profile_status).toBe('legacy-unversioned');
    expect(summary?.profile).toEqual({
      id: current.id,
      algorithm_version: current.algorithmVersion,
      config_hash: current.configHash,
      language: current.language,
      market: current.market,
    });
    expect(summary?.historical_profile).toBeUndefined();
    expect(summary?.profile.id).not.toBe('aio-legacy');
  });

  it('returns mismatch status with current profile and original historical_profile', () => {
    const current = aioRProfile();
    const historical = {
      id: 'aio-r',
      algorithmVersion: 'aio-r-2026-09-01',
      configHash: 'fnv1a-legacy-sample',
      language: 'en',
      market: 'us',
    };
    const run = createCrawlRunFixture({
      result: createCrawlResultFixture({
        pages: [GOOD_PAGE, WEAK_PAGE],
        aio_profile: historical,
      }),
    });

    const summary = crawlAioSummary(run);
    expect(summary).toBeDefined();
    expect(summary?.profile_status).toBe('mismatch');
    expect(summary?.profile).toEqual({
      id: current.id,
      algorithm_version: current.algorithmVersion,
      config_hash: current.configHash,
      language: current.language,
      market: current.market,
    });
    expect(summary?.historical_profile).toEqual({
      id: historical.id,
      algorithm_version: historical.algorithmVersion,
      config_hash: historical.configHash,
      language: historical.language,
      market: historical.market,
    });
  });

  it('guarantees run input immutability and preserves 1-decimal metric precision', () => {
    const run = createCrawlRunFixture({
      result: createCrawlResultFixture({
        pages: [GOOD_PAGE, WEAK_PAGE],
        aio_profile: {
          id: 'aio-r',
          algorithmVersion: 'aio-r-2026-10-26',
          configHash: 'cfg-hash',
          language: 'und',
          market: 'und',
        },
      }),
    });

    Object.freeze(run);
    if (run.result) Object.freeze(run.result);
    const before = JSON.stringify(run);

    const summary = crawlAioSummary(run);
    expect(summary).toBeDefined();
    expect(JSON.stringify(run)).toBe(before);

    if (summary) {
      expect(Math.round(summary.score * 10) / 10).toBe(summary.score);
      expect(Math.round(summary.self_containment * 10) / 10).toBe(summary.self_containment);
      expect(Math.round(summary.spo_density * 10) / 10).toBe(summary.spo_density);
      expect(Math.round(summary.extractability * 10) / 10).toBe(summary.extractability);
      for (const page of summary.pages) {
        expect(Math.round(page.score * 10) / 10).toBe(page.score);
      }
    }
  });
});
