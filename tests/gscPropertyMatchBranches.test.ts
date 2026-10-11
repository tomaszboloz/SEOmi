import { describe, expect, it } from 'vitest';
import type { GscSiteProperty } from '@/types';
import { matchGscProperty, selectGscProperty } from '@/services/gscPropertyMatch';

const owned = (...siteUrls: string[]): GscSiteProperty[] =>
  siteUrls.map((siteUrl) => ({ siteUrl, permissionLevel: 'siteOwner' }));

describe('gscPropertyMatch deep branches', () => {
  it('covers scheme-less root, trailing dots, and malformed domain properties', () => {
    // Scheme-less root URL defaults to https://
    expect(matchGscProperty(owned('sc-domain:site.test'), 'site.test/blog')).toBe('sc-domain:site.test');
    // Trailing dot normalization
    expect(matchGscProperty(owned('sc-domain:site.test.'), 'https://site.test')).toBe('sc-domain:site.test.');
    // IP domain property is rejected
    expect(matchGscProperty(owned('sc-domain:192.168.1.1'), 'https://192.168.1.1')).toBeNull();
    // Domain with port or path or credentials
    expect(matchGscProperty(owned('sc-domain:site.test:8080'), 'https://site.test')).toBeNull();
    expect(matchGscProperty(owned('sc-domain:site.test/sub'), 'https://site.test')).toBeNull();
    expect(matchGscProperty(owned('sc-domain:user@site.test'), 'https://site.test')).toBeNull();
  });

  it('covers prefix without trailing slash and invalid non-http protocols', () => {
    // Prefix property without trailing slash matches matching path
    expect(matchGscProperty(owned('https://site.test/blog'), 'https://site.test/blog/post')).toBe('https://site.test/blog');
    // Prefix property with credentials in URL
    expect(matchGscProperty(owned('https://user@site.test/'), 'https://site.test/')).toBeNull();
    // Invalid protocol in rootUrl
    expect(matchGscProperty(owned('sc-domain:site.test'), 'ftp://site.test')).toBeNull();
    expect(matchGscProperty(owned('sc-domain:site.test'), 'file:///site.test')).toBeNull();
  });

  it('selectGscProperty handles invalid root with non-empty string and empty account', () => {
    // Non-empty but invalid rootUrl returns empty string even if properties exist
    expect(selectGscProperty(owned('sc-domain:site.test'), '', 'ftp://invalid-url')).toBe('');
    // Empty properties with undefined root
    expect(selectGscProperty([], '', undefined)).toBe('');
  });
});
