import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRegistryMatcher } from '@/services/eeatTrust/registryIdentity';
import { applyRegistryEvidence, registryEvidenceKey } from '@/services/eeatTrust/registryEvidence';
import { readRegistryRecord } from '@/services/eeatTrust/registryRecords';
import { classifyProfile } from '@/services/eeatTrust/identifiers';
import { clearRegistryCache, safeRegistryUrl, verifyProfile } from '@/services/eeatTrust/registry';

const profile = classifyProfile('https://orcid.org/0000-0002-1825-0097');
const identity = { name: 'Anna Żółć', id: 'https://example.test/authors/anna#person', role: 'author' as const };
const record = (id = profile.id, name = 'Anna', family = 'Żółć', url = 'https://example.test/authors/anna') => JSON.stringify({
  'orcid-identifier': { path: id }, person: { name: { 'given-names': { value: name }, 'family-name': { value: family } },
    'researcher-urls': { 'researcher-url': [{ url: { value: url } }] } },
});
const response = (body = record()) => ({ status: 200, url: `https://pub.orcid.org/v3.0/${profile.id}`, body });
afterEach(() => { clearRegistryCache(); vi.useRealTimers(); });

describe('registry identity corroboration', () => {
  it('requires an exact identifier, Unicode name and reciprocal profile URL', () => {
    const match = createRegistryMatcher(identity);
    expect(match(profile, response())).toBe(true);
    expect(match(profile, response(record(profile.id, 'Other', 'Person')))).toBeUndefined();
    expect(match(profile, response(record(profile.id, 'Anna', 'Żółć', 'https://other.test/authors/anna')))).toBeUndefined();
    expect(match(profile, response(record('0000-0001-5109-3700')))).toBe(false);
    expect(createRegistryMatcher({ ...identity, id: 'https://example.test/' })(profile, response(record(profile.id, 'Anna', 'Żółć', 'https://example.test/')))).toBeUndefined();
    expect(createRegistryMatcher({ ...identity, role: 'publisher', id: 'https://example.test/' })(profile, response(record(profile.id, 'Anna', 'Żółć', 'https://example.test/')))).toBe(true);
  });

  it('accepts explicit aliases and normalizes Unicode without guessing a surname from a slug', () => {
    const data = JSON.parse(record());
    data.person['other-names'] = { 'other-name': [{ content: 'A. Żółć' }] };
    expect(createRegistryMatcher({ ...identity, name: 'A. Żo\u0301łć' })(profile, response(JSON.stringify(data)))).toBe(true);
    expect(createRegistryMatcher({ ...identity, name: 'Anna', aliases: ['Anna Żółć'] })(profile, response())).toBe(true);
    expect(createRegistryMatcher({ ...identity, name: 'A. Zolc' })(profile, response())).toBeUndefined();
  });

  it('treats missing, HTML or unrelated JSON as fetched-only evidence', () => {
    const match = createRegistryMatcher(identity);
    for (const body of ['', '<html>Anna Żółć</html>', 'null', '{}', '{"name":"Anna Żółć"}', record().slice(0, -1)]) {
      expect(match(profile, response(body))).toBeUndefined();
    }
    expect(readRegistryRecord(profile, 'x'.repeat(512_001))).toBeUndefined();
  });

  it('reads Wikidata labels, explicit aliases and official website claims', () => {
    const wikidata = classifyProfile('https://www.wikidata.org/wiki/Q42');
    const body = JSON.stringify({ entities: { Q42: { id: 'Q42', labels: { pl: { value: 'Anna Żółć' } },
      aliases: { en: [{ value: 'A. Żółć' }] }, claims: { P856: [{ mainsnak: { datavalue: { value: 'https://example.test/authors/anna' } } }] } } } });
    expect(createRegistryMatcher(identity)(wikidata, { ...response(body), url: 'https://www.wikidata.org/wiki/Special:EntityData/Q42.json' })).toBe(true);
    expect(createRegistryMatcher(identity)(wikidata, response(body))).toBeUndefined();
    expect(readRegistryRecord(wikidata, JSON.stringify({ entities: { Q43: { id: 'Q43' } } }))?.id).toBe('Q43');
    expect(readRegistryRecord(wikidata, JSON.stringify({ entities: { Q43: {}, Q44: {} } }))).toBeUndefined();
  });

  it('does not transfer a verified profile between people or roles', () => {
    const verified = { ...profile, status: 'verified' as const };
    const evidence = { [registryEvidenceKey('anna', 'author', profile.url)]: verified, [profile.url]: verified };
    expect(applyRegistryEvidence([profile], 'anna', 'author', evidence)[0].status).toBe('verified');
    expect(applyRegistryEvidence([profile], 'other-person', 'author', evidence)[0].status).toBe('syntax-valid');
    expect(applyRegistryEvidence([profile], 'anna', 'reviewer', evidence)[0].status).toBe('syntax-valid');
    expect(applyRegistryEvidence([profile], 'anna', 'author', { [profile.url]: { ...profile, status: 'fetched' } })[0].status).toBe('fetched');
  });
});

describe('registry scope and deadline', () => {
  it('applies one request budget across independently scoped identity matchers', async () => {
    const budgetScope = {};
    const fetcher = vi.fn(async () => response());
    const first = { budgetScope, fetcher, maxRequests: 1, matches: createRegistryMatcher(identity) };
    expect((await verifyProfile(profile, first)).profile.status).toBe('verified');
    expect((await verifyProfile(profile, { ...first, matches: createRegistryMatcher(identity) })).profile.detail).toBe('rate-budget');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await verifyProfile(profile, first)).profile.status).toBe('verified');
  });

  it('times out even if the native transport ignores cancellation, and ignores a late response', async () => {
    vi.useFakeTimers();
    let finish!: (value: ReturnType<typeof response>) => void;
    const fetcher = () => new Promise<ReturnType<typeof response>>((resolve) => { finish = resolve; });
    const request = verifyProfile(profile, { fetcher, timeoutMs: 10, matches: createRegistryMatcher(identity) });
    await vi.advanceTimersByTimeAsync(11);
    expect((await request).profile.status).toBe('unavailable');
    finish(response());
    await Promise.resolve();
    expect((await request).profile.status).toBe('unavailable');
  });

  it('rejects nonstandard ports and userinfo before a registry fetch', () => {
    expect(safeRegistryUrl(`https://user@orcid.org/${profile.id}`, 'orcid')).toBeUndefined();
    expect(safeRegistryUrl(`https://orcid.org:444/${profile.id}`, 'orcid')).toBeUndefined();
  });
});
