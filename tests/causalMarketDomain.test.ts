import { describe, expect, it } from 'vitest';
import { areSitesIndependent, normalizeSiteDomain, propertyMatchScore } from '@/services/causalMarket/domain';

describe('causalMarket domain normalization and property matching', () => {
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

  it('scores exact property matches and rejects empty or blank inputs', () => {
    expect(propertyMatchScore('', 'https://example.com')).toBe(0);
    expect(propertyMatchScore('https://example.com', '')).toBe(0);
    expect(propertyMatchScore('https://example.com/', 'https://example.com')).toBe(1000);
    expect(propertyMatchScore('https://example.com/blog/', 'HTTPS://EXAMPLE.COM/blog')).toBe(1000);
    expect(propertyMatchScore('https://example.com/blog/', 'https://example.com/BLOG/')).toBe(0);
  });

  it('scores domain property matches against domains and covering URLs', () => {
    expect(propertyMatchScore('sc-domain:example.com', 'sc-domain:example.com')).toBe(1000);
    expect(propertyMatchScore('sc-domain:example.com', 'sc-domain:other.com')).toBe(0);
    expect(propertyMatchScore('sc-domain:example.com', 'https://example.com/path')).toBe(500 + 'example.com'.length);
    expect(propertyMatchScore('sc-domain:example.com', 'https://sub.example.com/path')).toBe(500 + 'example.com'.length);
    expect(propertyMatchScore('sc-domain:example.com', 'https://other.com/path')).toBe(0);
    expect(propertyMatchScore('sc-domain:example.com', 'invalid-url')).toBe(0);
  });

  it('rejects substituting narrower URL prefix when target is explicit sc-domain', () => {
    expect(propertyMatchScore('https://example.com/', 'sc-domain:example.com')).toBe(0);
    expect(propertyMatchScore('https://example.com/blog', 'sc-domain:example.com')).toBe(0);
    expect(propertyMatchScore('https://sub.example.com/', 'sc-domain:example.com')).toBe(0);
  });

  it('scores URL prefixes against URL targets and rejects credentials, sibling and non-http', () => {
    expect(propertyMatchScore('https://example.com/blog/', 'https://example.com/blog/post')).toBe(600 + '/blog/'.length);
    expect(propertyMatchScore('https://example.com/', 'https://example.com/blog/post')).toBe(600 + '/'.length);
    expect(propertyMatchScore('https://example.com/store/', 'https://example.com/blog/post')).toBe(0);
    expect(propertyMatchScore('http://example.com/', 'https://example.com/')).toBe(0);
    expect(propertyMatchScore('https://example.com:8080/', 'https://example.com:9090/')).toBe(0);
    expect(propertyMatchScore('https://www.example.com/', 'https://app.example.com/')).toBe(0);
    expect(propertyMatchScore('ftp://example.com/', 'https://example.com/')).toBe(0);
    expect(propertyMatchScore('https://user:pass@example.com/', 'https://example.com/')).toBe(0);
    expect(propertyMatchScore('invalid-url', 'https://example.com/')).toBe(0);
    expect(propertyMatchScore('https://example.com/', 'invalid-target')).toBe(0);
  });
});
