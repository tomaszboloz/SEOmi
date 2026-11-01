import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readAuthorityHistory, readRefreshState, readTaxonomy, runScheduledAuthority, writeRefreshState, writeTaxonomy } from '@/services/topicalAuthorityMonitoring';
import type { ReferenceOutcome } from '@/services/topicalAuthorityReference';
import { COMPETITORS, NOW, OWN_HOST, ownSite, referenceTaxonomy } from './authorityFixtures';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

const pages = ownSite();
const clock = () => Date.parse(NOW);
const market = () => ({ country: 'US', language: 'en' });
const run = createCrawlRunFixture({ id: 'sched-1', startUrl: `https://${OWN_HOST}/`, result: createCrawlResultFixture({ pages, pages_crawled: pages.length, sitemap_urls: [] }) });
const ok = (): ReferenceOutcome => ({ status: 'ok', taxonomy: { ...referenceTaxonomy(pages)!, builtAt: NOW }, competitors: COMPETITORS, attempted: COMPETITORS.map((item) => item.domain) });
const enable = (extra = {}) => writeRefreshState('p1', { enabled: true, failures: 0, attempts: [], ...extra });
beforeEach(() => localStorage.clear());

describe('runScheduledAuthority (#61 GEM-61-04/06/07)', () => {
  it('skips invalid projects and runs without pages', async () => {
    expect(await runScheduledAuthority('bad id!', run, { clock })).toMatchObject({ recorded: false, skipped: 'invalid' });
    const empty = createCrawlRunFixture({ id: 'e', result: createCrawlResultFixture({ pages: [] }) });
    expect(await runScheduledAuthority('p1', empty, { clock })).toMatchObject({ recorded: false, skipped: 'invalid' });
  });

  it('records once without refreshing while the refresh is not opted in', async () => {
    const refresh = vi.fn();
    expect(await runScheduledAuthority('p1', run, { clock, market, refresh })).toEqual({ recorded: true, refresh: 'disabled' });
    expect(refresh).not.toHaveBeenCalled();
    expect(readAuthorityHistory('p1')).toHaveLength(1);
    expect(await runScheduledAuthority('p1', run, { clock, market, refresh })).toMatchObject({ recorded: false });
  });

  it('uses the default market and reports a missing source without spending an attempt', async () => {
    enable();
    writeTaxonomy('p1', { ...referenceTaxonomy(pages)!, builtAt: new Date().toISOString() });
    expect(await runScheduledAuthority('p1', run)).toMatchObject({ refresh: 'no-source' });
    expect(readRefreshState('p1').attempts).toEqual([]);
  });

  it('refreshes the map, stores it with its market and books the attempt', async () => {
    enable();
    const refresh = vi.fn().mockResolvedValue(ok());
    expect(await runScheduledAuthority('p1', run, { clock, market, refresh })).toEqual({ recorded: true, refresh: 'ran' });
    expect(refresh).toHaveBeenCalledWith(expect.objectContaining({ startUrl: run.startUrl }));
    expect(readTaxonomy('p1', clock())).toMatchObject({ market: { country: 'US', language: 'en' }, builtAt: NOW });
    expect(readRefreshState('p1')).toMatchObject({ failures: 0, lastSuccessAt: clock(), attempts: [clock()] });
    expect(readAuthorityHistory('p1').at(-1)?.snapshot.runId).toBe(`sched-1:${NOW}`);
    expect(await runScheduledAuthority('p1', run, { clock, market, refresh })).toEqual({ recorded: false, refresh: 'cooldown' });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('falls back to the settings market and survives an unparsable start URL', async () => {
    enable();
    const odd = { ...run, startUrl: 'not a url' };
    expect(await runScheduledAuthority('p1', odd, { clock, refresh: async () => ok() })).toMatchObject({ refresh: 'ran' });
  });

  it('treats unavailable and throwing refreshes as failures with backoff, still recording TAS', async () => {
    enable();
    const refresh = vi.fn().mockResolvedValueOnce({ status: 'unavailable', reason: 'serp-failed' }).mockRejectedValueOnce(new Error('offline'));
    expect(await runScheduledAuthority('p1', run, { clock, market, refresh })).toEqual({ recorded: true, refresh: 'failed' });
    expect(readRefreshState('p1')).toMatchObject({ failures: 1 });
    expect(await runScheduledAuthority('p1', run, { clock, market, refresh })).toMatchObject({ refresh: 'backoff' });
    const later = () => clock() + 3_600_000;
    expect(await runScheduledAuthority('p1', run, { clock: later, market, refresh })).toMatchObject({ refresh: 'failed' });
    expect(readRefreshState('p1').failures).toBe(2);
  });

  it('applies a cached map only when it matches the core topic and market', async () => {
    writeTaxonomy('p1', { ...referenceTaxonomy(pages)!, builtAt: NOW, market: { country: 'US', language: 'en' } });
    await runScheduledAuthority('p1', run, { clock, market });
    expect(readAuthorityHistory('p1').at(-1)?.snapshot.runId).toBe(`sched-1:${NOW}`);
    await runScheduledAuthority('p2', run, { clock, market: () => ({ country: 'DE', language: 'de' }) });
    expect(readAuthorityHistory('p2')).toHaveLength(1);
    writeTaxonomy('p3', { ...referenceTaxonomy(pages)!, builtAt: NOW, market: { country: 'PL', language: 'pl' } });
    await runScheduledAuthority('p3', run, { clock, market });
    expect(readAuthorityHistory('p3').at(-1)?.snapshot.runId).toBe('sched-1');
  });

  it('never rejects into the caller', async () => {
    const broken = () => { throw new Error('clock failed'); };
    expect(await runScheduledAuthority('p1', run, { clock: broken })).toEqual({ recorded: false, refresh: 'failed', skipped: 'error' });
  });
});
