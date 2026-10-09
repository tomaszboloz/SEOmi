import { describe, expect, it } from 'vitest';
import type { GscSiteProperty } from '@/types';
import { matchGscProperty, selectGscProperty } from '@/services/gscPropertyMatch';

const owned = (...siteUrls: string[]): GscSiteProperty[] => siteUrls.map((siteUrl) => ({ siteUrl, permissionLevel: 'siteOwner' }));
const unverified = (siteUrl: string): GscSiteProperty => ({ siteUrl, permissionLevel: 'siteUnverifiedUser' });

describe('matchGscProperty', () => {
  it('prefers a verified domain property and requires the URL-prefix protocol', () => {
    expect(matchGscProperty(owned('https://site.test/', 'sc-domain:site.test'), 'https://site.test')).toBe('sc-domain:site.test');
    expect(matchGscProperty(owned('http://site.test/', 'https://site.test/'), 'https://site.test/blog')).toBe('https://site.test/');
    expect(matchGscProperty(owned('https://site.test/'), 'http://site.test')).toBeNull();
    expect(matchGscProperty(owned('http://site.test/'), 'http://site.test')).toBe('http://site.test/');
    expect(matchGscProperty(owned('https://site.test:8443/'), 'https://site.test')).toBeNull();
    expect(matchGscProperty(owned('https://site.test:8443/'), 'https://site.test:8443')).toBe('https://site.test:8443/');
    expect(matchGscProperty(owned('https://site.test/'), 'https://user:secret@site.test')).toBeNull();
  });

  it('lets a domain property cover www, while URL-prefix properties require the exact host', () => {
    expect(matchGscProperty(owned('sc-domain:site.test'), 'https://www.site.test')).toBe('sc-domain:site.test');
    expect(matchGscProperty(owned('https://www.site.test/'), 'https://site.test')).toBeNull();
    expect(matchGscProperty(owned('sc-domain:www.site.test'), 'https://site.test')).toBeNull();
    expect(matchGscProperty(owned('https://www.site.test/'), 'https://www.site.test')).toBe('https://www.site.test/');
  });

  it('requires a path boundary and chooses the longest covering prefix', () => {
    const properties = owned('https://site.test/blog/', 'https://site.test/blog/pl/', 'https://site.test/blogger/');
    expect(matchGscProperty(properties, 'https://site.test/blog/pl/start')).toBe('https://site.test/blog/pl/');
    expect(matchGscProperty(properties, 'https://site.test/blogger/post')).toBe('https://site.test/blogger/');
    expect(matchGscProperty(owned('https://site.test/blog/'), 'https://site.test/blogger')).toBeNull();
  });

  it('matches real parent domains and rejects public suffixes', () => {
    expect(matchGscProperty(owned('sc-domain:site.test'), 'https://blog.site.test')).toBe('sc-domain:site.test');
    expect(matchGscProperty(owned('sc-domain:blog.site.test'), 'https://blog.site.test')).toBe('sc-domain:blog.site.test');
    expect(matchGscProperty(owned('sc-domain:blog.site.test'), 'https://www.blog.site.test')).toBe('sc-domain:blog.site.test');
    expect(matchGscProperty(owned('sc-domain:blog.site.test'), 'https://shop.site.test')).toBeNull();
    expect(matchGscProperty(owned('sc-domain:blog.site.test'), 'https://site.test')).toBeNull();
    expect(matchGscProperty(owned('sc-domain:co.uk'), 'https://blog.co.uk')).toBeNull();
    expect(matchGscProperty(owned('sc-domain:github.io'), 'https://foo.github.io')).toBeNull();
    expect(matchGscProperty(owned('sc-domain:foo.github.io'), 'https://blog.foo.github.io')).toBe('sc-domain:foo.github.io');
  });

  it('never matches unverified, lookalike, or missing-root properties', () => {
    expect(matchGscProperty([unverified('sc-domain:site.test')], 'https://site.test')).toBeNull();
    expect(matchGscProperty(owned('sc-domain:notsite.test', 'https://site.test.evil.test/'), 'https://site.test')).toBeNull();
    for (const rootUrl of [undefined, '', '   ', 'http://']) expect(matchGscProperty(owned('sc-domain:site.test'), rootUrl)).toBeNull();
  });
});

describe('selectGscProperty', () => {
  const account = owned('sc-domain:unrelated.test', 'https://site.test/', 'sc-domain:site.test');

  it('keeps stored only when it covers the project root and discards stale or unverified values', () => {
    expect(selectGscProperty(account, 'https://site.test/', 'https://site.test')).toBe('https://site.test/');
    expect(selectGscProperty(account, 'sc-domain:unrelated.test', 'https://site.test')).toBe('sc-domain:site.test');
    expect(selectGscProperty([...account, unverified('sc-domain:site.test')], 'sc-domain:site.test', 'https://site.test')).toBe('sc-domain:site.test');
    expect(selectGscProperty([unverified('sc-domain:site.test')], 'sc-domain:site.test', 'https://site.test')).toBe('');
  });

  it('selects no unrelated property and uses the first verified one without a root', () => {
    expect(selectGscProperty(account, '', 'https://absent.test')).toBe('');
    expect(selectGscProperty(account, '', 'https://user:secret@site.test')).toBe('');
    expect(selectGscProperty([unverified('sc-domain:blocked.test'), ...account], '', undefined)).toBe('sc-domain:unrelated.test');
    expect(selectGscProperty([unverified('sc-domain:blocked.test')], '', undefined)).toBe('');
  });
});
