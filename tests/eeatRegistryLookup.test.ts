import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bodyNames, defaultIdentityMatcher } from '@/services/eeatTrust/identityMatch';
import { registryLookupUrl } from '@/services/eeatTrust/profileLinks';
import { clearRegistryCache, safeRegistryUrl, verifyProfile } from '@/services/eeatTrust/registry';
import type { ProfileEvidence } from '@/services/eeatTrust';

const orcid: ProfileEvidence = { url: 'https://orcid.org.evil.test/0000-0002-1825-0097', kind: 'orcid', tier: 1, id: '0000-0002-1825-0097', status: 'syntax-valid', subjects: ['Josiah Carberry'] };
const wikidata: ProfileEvidence = { url: 'https://www.wikidata.org/wiki/Q42', kind: 'wikidata', tier: 1, id: 'Q42', status: 'syntax-valid', subjects: ['Douglas Adams'] };
const orcidXml = `<?xml version="1.0"?><person:person><person:name><personal-details:given-names>Josiah</personal-details:given-names><personal-details:family-name>Carberry</personal-details:family-name><personal-details:credit-name>J. S. Carberry</personal-details:credit-name></person:name><other-name:other-names><other-name:other-name><other-name:content>Josiah Stinkney Carberry</other-name:content></other-name:other-name></other-name:other-names></person:person>`;

describe('live ORCID / Wikidata identity lookup (#87)', () => {
  beforeEach(() => clearRegistryCache());

  it('builds the structured lookup from the parsed id, never from the declared URL', () => {
    expect(registryLookupUrl(orcid)).toBe('https://pub.orcid.org/v3.0/0000-0002-1825-0097/person');
    expect(registryLookupUrl(wikidata)).toBe('https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q42&props=labels%7Caliases&format=json');
    expect(registryLookupUrl({ kind: 'orcid', id: '0000-0002-1825-0098' })).toBeUndefined();
    expect(registryLookupUrl({ kind: 'wikidata', id: 'Q0' })).toBeUndefined();
    expect(registryLookupUrl({ kind: 'register', id: 'x' })).toBeUndefined();
    expect(safeRegistryUrl(registryLookupUrl(orcid) as string, 'orcid')).toBeDefined();
    expect(safeRegistryUrl(registryLookupUrl(wikidata) as string, 'wikidata')).toBeDefined();
  });

  it('reads names from the ORCID public API XML record', () => {
    expect(bodyNames(orcidXml)).toEqual(['Josiah Carberry', 'J. S. Carberry', 'Josiah Stinkney Carberry']);
    expect(defaultIdentityMatcher(orcid, { body: orcidXml })).toBe(true);
    expect(defaultIdentityMatcher({ ...orcid, subjects: ['Anna Nowak'] }, { body: orcidXml })).toBe(false);
  });

  it('fetches the registry API record, records the lookup and matches the name', async () => {
    const fetcher = vi.fn(async (url: string) => ({ status: 200, url, body: url.includes('orcid') ? orcidXml : JSON.stringify({ entities: { Q42: { labels: { en: { language: 'en', value: 'Douglas Adams' } }, aliases: {} } }, success: 1 }) }));
    const first = await verifyProfile(orcid, { fetcher, now: () => '2026-10-30T00:00:00Z' });
    const second = await verifyProfile(wikidata, { fetcher, now: () => '2026-10-30T00:00:00Z' });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([registryLookupUrl(orcid), registryLookupUrl(wikidata)]);
    expect(first.profile).toMatchObject({ status: 'verified', lookupUrl: registryLookupUrl(orcid), fetchedAt: '2026-10-30T00:00:00Z' });
    expect(second.profile.status).toBe('verified');
  });

  it('keeps a missing Wikidata entity and unreachable registry as not verified', async () => {
    const missing = vi.fn(async (url: string) => ({ status: 200, url, body: JSON.stringify({ entities: { Q42: { id: 'Q42', missing: '' } }, success: 1 }) }));
    expect((await verifyProfile(wikidata, { fetcher: missing })).profile.status).toBe('fetched');
    clearRegistryCache();
    const down = vi.fn(async (url: string) => ({ status: 503, url, body: '' }));
    expect((await verifyProfile(wikidata, { fetcher: down })).profile.status).toBe('unavailable');
    clearRegistryCache();
    const failing = vi.fn(async () => { throw new Error('offline'); });
    expect((await verifyProfile(wikidata, { fetcher: failing })).profile).toMatchObject({ status: 'unavailable', detail: 'transport-error' });
  });
});
