import { describe, expect, it } from 'vitest';
import { areSitesIndependent, normalizeSiteDomain } from '@/services/causalMarket/domain';

describe('causalMarket domain normalization', () => {
  it('normalizes sc-domain and url prefix properties of the same domain', () => {
    expect(normalizeSiteDomain('sc-domain:example.com')).toBe('example.com');
    expect(normalizeSiteDomain('https://example.com/')).toBe('example.com');
    expect(normalizeSiteDomain('http://www.example.com')).toBe('example.com');
    expect(normalizeSiteDomain('https://sub.example.com/path')).toBe('example.com');
  });

  it('normalizes hostnames without registered domain like IP addresses or localhost', () => {
    expect(normalizeSiteDomain('http://192.168.1.1/api')).toBe('192.168.1.1');
    expect(normalizeSiteDomain('http://localhost:3000/')).toBe('localhost');
  });

  it('recognizes identical or overlapping properties as not independent', () => {
    expect(areSitesIndependent('sc-domain:example.com', 'https://example.com/')).toBe(false);
    expect(areSitesIndependent('https://www.example.com', 'https://example.com/blog')).toBe(false);
    expect(areSitesIndependent('sc-domain:example.com', 'sc-domain:example.com')).toBe(false);
  });

  it('recognizes distinct domains as truly independent', () => {
    expect(areSitesIndependent('https://example.com', 'https://other-domain.org')).toBe(true);
    expect(areSitesIndependent('sc-domain:first.test', 'https://second.test/')).toBe(true);
  });

  it('handles edge cases safely without false positive independence', () => {
    expect(areSitesIndependent('', 'https://example.com')).toBe(false);
    expect(areSitesIndependent(null, 'https://example.com')).toBe(false);
    expect(areSitesIndependent('invalid-url', 'invalid-url')).toBe(false);
    expect(normalizeSiteDomain('http://[invalid-host')).toBe('');
  });
});
