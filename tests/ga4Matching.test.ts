import { describe, expect, it } from 'vitest';
import { ga4StreamMatchesRoot, matchGa4Property, matchingGa4Properties } from '@/services/ga4/matching';
import type { Ga4Property } from '@/types/ga4';

const prop = (name: string, ...stream_urls: string[]): Ga4Property => ({ name, stream_urls, display_name: name });

describe('GA4 property matching', () => {
  it('requires protocol, hostname, port and path boundaries', () => {
    expect(ga4StreamMatchesRoot('https://site.test/', 'https://site.test/blog')).toBe(true);
    expect(ga4StreamMatchesRoot('http://site.test/', 'https://site.test/blog')).toBe(false);
    expect(ga4StreamMatchesRoot('https://site.test/blog', 'https://site.test/blogger')).toBe(false);
    expect(ga4StreamMatchesRoot('https://www.site.test/', 'https://site.test/')).toBe(false);
    expect(ga4StreamMatchesRoot('https://site.test:8443/', 'https://site.test/')).toBe(false);
  });

  it('returns only an explicitly matching property and never the first unrelated one', () => {
    const properties = [prop('properties/unrelated', 'https://other.test/'), prop('properties/site', 'https://site.test/')];
    expect(matchGa4Property(properties, 'https://site.test/about')?.name).toBe('properties/site');
    expect(matchGa4Property(properties, 'https://missing.test/')).toBeNull();
  });

  it('requires a unique property when multiple matched properties exist', () => {
    const properties = [prop('properties/a', 'https://site.test/'), prop('properties/b', 'https://site.test/')];
    expect(matchingGa4Properties(properties, 'https://site.test/')).toHaveLength(2);
    expect(matchGa4Property(properties, 'https://site.test/')).toBeNull();
  });

  it('rejects malformed roots and credentials', () => {
    expect(matchingGa4Properties([prop('properties/site', 'https://site.test/')], 'not a url')).toEqual([]);
    expect(ga4StreamMatchesRoot('https://user:pass@site.test/', 'https://site.test/')).toBe(false);
  });
});
