import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyProfile } from '@/services/eeatTrust/identifiers';
import { clearRegistryCache, verifyProfile, type RegistryFetcher } from '@/services/eeatTrust/registry';

const ORCID = classifyProfile('https://orcid.org/0000-0002-1825-0097');
const WIKIDATA = classifyProfile('https://www.wikidata.org/wiki/Q42');
const ok: RegistryFetcher = async (url) => ({ status: 200, url, body: '{}' });

beforeEach(() => clearRegistryCache());

describe('registry transport bounds (#87 GEM-87-T02/T04)', () => {
  it('rejects a redirect to a private address or a foreign host after the fetch', async () => {
    for (const target of ['https://127.0.0.1/x', 'https://[::ffff:10.0.0.1]/x', 'https://orcid.org.evil.test/x', 'http://orcid.org/x']) {
      const result = await verifyProfile(ORCID, { fetcher: async () => ({ status: 200, url: target, body: '{}' }) });
      expect(result.profile).toMatchObject({ status: 'unavailable', detail: 'unsafe-redirect' });
      expect(result.profile.lookupUrl).toBeUndefined();
    }
  });

  it('refuses oversized bodies instead of parsing them', async () => {
    const result = await verifyProfile(ORCID, { fetcher: async (url) => ({ status: 200, url, body: 'x'.repeat(65) }), maxBytes: 64 });
    expect(result.profile).toMatchObject({ status: 'unavailable', detail: 'body-limit' });
  });

  it('maps 404, 403 and 429 to unavailable, never to a fictitious person', async () => {
    for (const status of [404, 403, 429]) {
      clearRegistryCache();
      const result = await verifyProfile(ORCID, { fetcher: async (url) => ({ status, url, body: '' }), now: () => '2026-10-30T00:00:00Z' });
      expect(result.profile).toMatchObject({ status: 'unavailable', fetchedAt: '2026-10-30T00:00:00Z' });
      expect(result.profile.lookupUrl).toContain('pub.orcid.org');
    }
  });

  it('aborts a slow registry at the timeout and reports a transport error', async () => {
    const slow: RegistryFetcher = (_url, signal) => new Promise((_, reject) => { signal.addEventListener('abort', () => reject(new Error('aborted'))); });
    const result = await verifyProfile(WIKIDATA, { fetcher: slow, timeoutMs: 5 });
    expect(result.profile).toMatchObject({ status: 'unavailable', detail: 'transport-error' });
  });

  it('stops at the per-run request budget without calling the fetcher', async () => {
    const fetcher = vi.fn(ok);
    const options = { fetcher, maxRequests: 1, matches: () => undefined };
    expect((await verifyProfile(ORCID, options)).profile.status).toBe('fetched');
    expect((await verifyProfile(WIKIDATA, options)).profile).toMatchObject({ status: 'unavailable', detail: 'rate-budget' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('marks a failed refresh of an expired entry as stale and refetches after the TTL', async () => {
    const options = { fetcher: vi.fn(ok), matches: () => true, ttlMs: 1000, now: () => '2026-10-30T00:00:00Z' };
    expect((await verifyProfile(ORCID, options)).profile.status).toBe('verified');
    options.now = () => '2026-10-30T00:00:02Z';
    options.fetcher.mockRejectedValueOnce(new Error('down'));
    expect(await verifyProfile(ORCID, options)).toMatchObject({ stale: true, profile: { status: 'unavailable', detail: 'transport-error' } });
    expect(options.fetcher).toHaveBeenCalledTimes(2);
  });

  it('never fetches invalid or already evaluated profiles, and needs a transport', async () => {
    const fetcher = vi.fn(ok);
    const invalid = classifyProfile('https://orcid.org/0000-0002-1825-0098');
    expect((await verifyProfile(invalid, { fetcher })).profile).toBe(invalid);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await verifyProfile(ORCID)).profile).toMatchObject({ status: 'unavailable', detail: 'registry-unavailable' });
  });
});
