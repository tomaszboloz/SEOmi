import { describe, expect, it } from 'vitest';
import {
  normalizeTrafficUrl,
  normalizeTrafficProperty,
  trafficPropertyMatchesUrl,
} from '@/services/semanticGraph/trafficEvidenceNormalization';

describe('normalizeTrafficUrl', () => {
  it('returns empty for non-string, empty and non-http inputs', () => {
    expect(normalizeTrafficUrl(null)).toBe('');
    expect(normalizeTrafficUrl(undefined)).toBe('');
    expect(normalizeTrafficUrl(42)).toBe('');
    expect(normalizeTrafficUrl('  ')).toBe('');
    expect(normalizeTrafficUrl('ftp://example.com/')).toBe('');
    expect(normalizeTrafficUrl('not-a-url')).toBe('');
  });

  it('strips fragments and trailing slashes from paths', () => {
    expect(normalizeTrafficUrl('https://example.com/page/#anchor')).toBe('https://example.com/page');
    expect(normalizeTrafficUrl('http://example.com/path/')).toBe('http://example.com/path');
  });

  it('preserves root path slash and lowercases hostname', () => {
    expect(normalizeTrafficUrl('https://example.com/')).toBe('https://example.com/');
    expect(normalizeTrafficUrl('HTTPS://EXAMPLE.COM/path')).toBe('https://example.com/path');
  });
});

describe('normalizeTrafficProperty', () => {
  it('handles sc-domain prefix with lowercasing', () => {
    const result = normalizeTrafficProperty('sc-domain:Example.COM');
    expect(result?.kind).toBe('domain');
    expect(result?.host).toBe('example.com');
    expect(result?.key).toBe('sc-domain:example.com');
  });

  it('handles prefix URL properties and root URL property', () => {
    const prefix = normalizeTrafficProperty('https://example.com/blog/');
    expect(prefix?.kind).toBe('prefix');
    expect(prefix?.protocol).toBe('https:');
    expect(prefix?.prefix).toBe('/blog');
    expect(prefix?.key).toBe('https://example.com/blog/');

    const root = normalizeTrafficProperty('https://example.com/');
    expect(root?.kind).toBe('prefix');
    expect(root?.prefix).toBe('/');
  });

  it('rejects invalid inputs', () => {
    expect(normalizeTrafficProperty(null)).toBeNull();
    expect(normalizeTrafficProperty('')).toBeNull();
    expect(normalizeTrafficProperty('sc-domain:')).toBeNull();
    expect(normalizeTrafficProperty('sc-domain:exam/ple')).toBeNull();
    expect(normalizeTrafficProperty('ftp://example.com/')).toBeNull();
    expect(normalizeTrafficProperty('https://user:pass@example.com/')).toBeNull();
    expect(normalizeTrafficProperty('not a valid url')).toBeNull();
  });
});

describe('trafficPropertyMatchesUrl', () => {
  it('domain scope matches host and subdomains', () => {
    const scope = normalizeTrafficProperty('sc-domain:example.com')!;
    expect(trafficPropertyMatchesUrl(scope, 'https://example.com/page')).toBe(true);
    expect(trafficPropertyMatchesUrl(scope, 'https://sub.example.com/')).toBe(true);
    expect(trafficPropertyMatchesUrl(scope, 'https://other.com/')).toBe(false);
  });

  it('prefix scope matches exact and nested paths', () => {
    const scope = normalizeTrafficProperty('https://example.com/blog/')!;
    expect(trafficPropertyMatchesUrl(scope, 'https://example.com/blog/post')).toBe(true);
    expect(trafficPropertyMatchesUrl(scope, 'https://example.com/blog')).toBe(true);
    expect(trafficPropertyMatchesUrl(scope, 'https://example.com/other')).toBe(false);
    expect(trafficPropertyMatchesUrl(scope, 'https://other.com/blog')).toBe(false);
    expect(trafficPropertyMatchesUrl(scope, 'invalid-url')).toBe(false);
  });

  it('keeps protocol and explicit ports in prefix scope identity', () => {
    const https = normalizeTrafficProperty('https://example.com/blog')!;
    expect(trafficPropertyMatchesUrl(https, 'http://example.com/blog/post')).toBe(false);
    expect(trafficPropertyMatchesUrl(https, 'https://example.com:8443/blog/post')).toBe(false);
    const port = normalizeTrafficProperty('https://example.com:8443/blog')!;
    expect(port.key).toBe('https://example.com:8443/blog/');
    expect(trafficPropertyMatchesUrl(port, 'https://example.com:8443/blog/post')).toBe(true);
    expect(trafficPropertyMatchesUrl(port, 'https://example.com/blog/post')).toBe(false);
  });
});
