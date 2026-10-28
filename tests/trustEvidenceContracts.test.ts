import { describe, expect, it, vi } from 'vitest';
import { extractCitationReferences, mapClaimsToCitations } from '@/services/citationEvidence/claims';
import { clearRegistryCache, safeRegistryUrl, verifyProfile } from '@/services/eeatTrust/registry';
import { classifyProfile } from '@/services/eeatTrust/identifiers';

describe('claim citation evidence', () => {
  it('keeps DOI/PMID offsets and maps a same-sentence high-stakes claim', () => {
    const text = 'Badania wykazały, że ryzyko spadło o 20% (doi:10.1000/test).';
    const refs = extractCitationReferences(text);
    expect(refs.some((ref) => ref.kind === 'doi' && ref.start < ref.end)).toBe(true);
    const claims = mapClaimsToCitations(text, [{ key: 'doi:10.1000/test', exists: true, reachable: true, topical: true }]);
    expect(claims[0]).toMatchObject({ relation: 'same-sentence', sourceExists: true, reachable: true, topical: true, sourceChecked: false, supportsClaim: null });
  });

  it('does not treat overlap or an adjacent citation as manual support', () => {
    const claims = mapClaimsToCitations('Badania wykazały wzrost ryzyka o 20%.\nŹródło: doi:10.1000/test.', [{ key: 'doi:10.1000/test', exists: true }]);
    expect(claims[0]).toMatchObject({ relation: 'adjacent-sentence', evidence: 'association', sourceChecked: false, supportsClaim: null });
  });
});

describe('bounded registry transport', () => {
  it('rejects suffix spoofing and private targets before fetch', async () => {
    expect(safeRegistryUrl('https://orcid.org.evil.test/0000-0002-1825-0097', 'orcid')).toBeUndefined();
    expect(safeRegistryUrl('https://127.0.0.1/0000-0002-1825-0097', 'orcid')).toBeUndefined();
    expect(safeRegistryUrl('https://[::ffff:127.0.0.1]/0000-0002-1825-0097', 'orcid')).toBeUndefined();
    const profile = classifyProfile('https://orcid.org/0000-0002-1825-0097');
    const result = await verifyProfile(profile);
    expect(result.profile.status).toBe('unavailable');
  });

  it('separates fetched, verified and mismatch states and respects TTL cache', async () => {
    clearRegistryCache();
    const fetcher = vi.fn(async (url: string) => ({ status: 200, url, body: '{"id":"x"}' }));
    const profile = classifyProfile('https://orcid.org/0000-0002-1825-0097');
    const options = { fetcher, now: () => '2026-10-27T00:00:00Z', matches: () => true };
    expect((await verifyProfile(profile, options)).profile.status).toBe('verified');
    expect((await verifyProfile(profile, options)).stale).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await verifyProfile(profile, { ...options, matches: () => false, now: () => '2026-10-29T00:00:00Z' })).profile.status).toBe('mismatch');
  });
});
