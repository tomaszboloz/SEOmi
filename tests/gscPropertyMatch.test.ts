import { describe, expect, it } from 'vitest';
import type { GscSiteProperty } from '@/types';
import { matchGscProperty, selectGscProperty } from '@/services/gscPropertyMatch';

const owned = (...siteUrls: string[]): GscSiteProperty[] => siteUrls.map((siteUrl) => ({ siteUrl, permissionLevel: 'siteOwner' }));

describe('matchGscProperty', () => {
  const account = owned('sc-domain:unrelated.test', 'https://site.test/', 'sc-domain:site.test', 'http://site.test/', 'https://other.test/');

  it('prefers the domain property, then https, then http, for the project host', () => {
    expect(matchGscProperty(account, 'https://site.test')).toBe('sc-domain:site.test');
    expect(matchGscProperty(owned('http://site.test/', 'https://site.test/'), 'https://site.test/blog/')).toBe('https://site.test/');
    expect(matchGscProperty(owned('sc-domain:unrelated.test', 'http://site.test/'), 'site.test')).toBe('http://site.test/');
  });

  it('treats www and the bare host as the same site in both directions', () => {
    expect(matchGscProperty(owned('https://www.site.test/'), 'https://site.test')).toBe('https://www.site.test/');
    expect(matchGscProperty(owned('sc-domain:site.test'), 'https://WWW.Site.Test/')).toBe('sc-domain:site.test');
  });

  it('uses a parent domain property for a subdomain and the longest covering section property', () => {
    expect(matchGscProperty(owned('sc-domain:test', 'sc-domain:site.test'), 'https://blog.site.test/')).toBe('sc-domain:site.test');
    expect(matchGscProperty(owned('https://site.test/shop/', 'https://site.test/blog/', 'https://site.test/blog/pl/'), 'https://site.test/blog/pl/start')).toBe('https://site.test/blog/pl/');
    expect(matchGscProperty(owned('https://site.test/shop/'), 'https://site.test/blog/')).toBeNull();
  });

  it('never matches an unverified property, a lookalike host or a missing root URL', () => {
    expect(matchGscProperty([{ siteUrl: 'sc-domain:site.test', permissionLevel: 'siteUnverifiedUser' }], 'https://site.test')).toBeNull();
    expect(matchGscProperty(owned('sc-domain:notsite.test', 'https://site.test.evil.test/'), 'https://site.test')).toBeNull();
    for (const rootUrl of [undefined, '', '   ', 'http://']) expect(matchGscProperty(account, rootUrl)).toBeNull();
  });
});

describe('selectGscProperty', () => {
  const account = owned('sc-domain:unrelated.test', 'https://site.test/', 'sc-domain:site.test');

  it('keeps the property the project already uses while it is still accessible', () => {
    expect(selectGscProperty(account, 'https://site.test/', 'https://site.test')).toBe('https://site.test/');
    expect(selectGscProperty(account, 'sc-domain:unrelated.test', 'https://site.test')).toBe('sc-domain:unrelated.test');
  });

  it('matches the project site when nothing valid is stored', () => {
    expect(selectGscProperty(account, '', 'https://site.test')).toBe('sc-domain:site.test');
    expect(selectGscProperty(account, 'sc-domain:gone.test', 'https://site.test')).toBe('sc-domain:site.test');
  });

  it('selects nothing for a project site without a property, and the first property without a root URL', () => {
    expect(selectGscProperty(account, '', 'https://absent.test')).toBe('');
    expect(selectGscProperty(account, '', undefined)).toBe('sc-domain:unrelated.test');
    expect(selectGscProperty([], '', undefined)).toBe('');
  });
});
