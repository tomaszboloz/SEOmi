import { describe, expect, it, vi } from 'vitest';
import { ga4StreamMatchesRoot, matchGa4Property, matchingGa4Properties } from '@/services/ga4/matching';
import type { Ga4Property } from '@/types/ga4';

const property = (name: string, ...stream_urls: string[]): Ga4Property => ({ name, stream_urls });

describe('GA4 matching boundary branches', () => {
  it('rejects empty, malformed, unsupported and credential-bearing URLs', () => {
    const site = 'https://site.test/';
    expect(matchingGa4Properties([property('properties/site', site)], undefined)).toEqual([]);
    expect(matchingGa4Properties([property('properties/site', site)], '   ')).toEqual([]);
    expect(ga4StreamMatchesRoot('not a url', site)).toBe(false);
    expect(ga4StreamMatchesRoot(site, 'not a url')).toBe(false);
    expect(ga4StreamMatchesRoot('ftp://site.test/', site)).toBe(false);
    expect(ga4StreamMatchesRoot('https://user:pass@site.test/', site)).toBe(false);
    expect(ga4StreamMatchesRoot('https://:secret@site.test/', site)).toBe(false);
    expect(ga4StreamMatchesRoot('https:///missing-host', site)).toBe(false);
  });

  it('normalizes trailing dots, root paths and trailing slash-only paths', () => {
    expect(ga4StreamMatchesRoot('https://site.test./', 'https://site.test/')).toBe(true);
    expect(ga4StreamMatchesRoot('https://site.test////', 'https://site.test/')).toBe(true);
    expect(ga4StreamMatchesRoot('https://site.test/docs', 'https://site.test/docs')).toBe(true);
    expect(ga4StreamMatchesRoot('https://site.test/docs', 'https://site.test/docs/start')).toBe(true);
    expect(ga4StreamMatchesRoot('https://site.test/docs', 'https://site.test/docs-other')).toBe(false);
    expect(ga4StreamMatchesRoot('https://site.test/docs', 'https://site.test/other/docs')).toBe(false);
  });

  it('checks host, protocol and port independently', () => {
    expect(ga4StreamMatchesRoot('https://other.test/', 'https://site.test/')).toBe(false);
    expect(ga4StreamMatchesRoot('http://site.test/', 'https://site.test/')).toBe(false);
    expect(ga4StreamMatchesRoot('https://site.test:8443/', 'https://site.test/')).toBe(false);
    expect(ga4StreamMatchesRoot('https://site.test:8443/', 'https://site.test:8443/')).toBe(true);
  });

  it('keeps the empty-path fallback covered for URL implementations that expose it', () => {
    const NativeURL = URL;
    class EmptyPathURL extends NativeURL { get pathname() { return ''; } }
    vi.stubGlobal('URL', EmptyPathURL);
    try { expect(ga4StreamMatchesRoot('https://site.test/', 'https://site.test/')).toBe(true); }
    finally { vi.unstubAllGlobals(); }
  });

  it('skips unmatched streams and duplicate property names', () => {
    const properties = [
      property('properties/empty', 'https://other.test/'),
      property('properties/site', 'https://site.test/', 'https://other.test/'),
      property('properties/site', 'https://site.test/docs'),
    ];
    const matches = matchingGa4Properties(properties, 'https://site.test/docs/page');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ name: 'properties/site', stream_urls: ['https://site.test/'] });
    expect(matchGa4Property([property('properties/a', 'https://site.test/'), property('properties/b', 'https://site.test/')], 'https://site.test/')).toBeNull();
  });
});
