import { describe, expect, it } from 'vitest';
import type { PageAuditData } from '@/types';
import { buildHttpAndUrlChecks } from '@/services/auditChecks/httpAndMetaChecks';
import { createAuditFixture } from './fixtures/audit';

const checks = (patch: Partial<PageAuditData> = {}) => {
  const result = buildHttpAndUrlChecks(createAuditFixture(patch));
  expect(result).toHaveLength(14);
  expect(new Set(result.map((check) => check.id)).size).toBe(14);
  expect(result.every((check) => check.label && check.category && check.evidence)).toBe(true);
  return Object.fromEntries(result.map((check) => [check.id, check.status]));
};

describe('HTTP audit boundaries', () => {
  it.each([[199, 'error'], [200, 'pass'], [299, 'pass'], [300, 'warning'], [399, 'warning'], [400, 'error']])('classifies observed HTTP status %i', (http_status, expected) => {
    expect(checks({ http_status: Number(http_status) }).http).toBe(expected);
  });
  it.each([
    [299, 'pass', 'pass', 'pass'], [300, 'pass', 'warning', 'pass'],
    [799, 'pass', 'warning', 'pass'], [800, 'warning', 'warning', 'pass'],
    [1999, 'warning', 'warning', 'pass'], [2000, 'error', 'warning', 'pass'],
    [-1, 'pass', 'pass', 'error'], [NaN, 'error', 'warning', 'error'], [Infinity, 'error', 'warning', 'error'],
  ])('distinguishes response-time thresholds and known measurement at %s', (ms, overall, fast, known) => {
    const result = checks({ response_time_ms: Number(ms) });
    expect(result['response-time']).toBe(overall);
    expect(result['response-time-fast']).toBe(fast);
    expect(result['response-time-known']).toBe(known);
  });
  it('distinguishes absent, relative, fragment and final fallback URLs', () => {
    const absent = checks({ url: '', final_url: '' });
    expect(absent).toMatchObject({ https: 'warning', 'url-absolute': 'error', 'final-url-absolute': 'error' });
    const relative = checks({ url: '/relative', final_url: '/other' });
    expect(relative).toMatchObject({ 'url-absolute': 'error', 'final-url-absolute': 'error' });
    const fallback = checks({ url: 'http://example.test/a#part', final_url: '' });
    expect(fallback).toMatchObject({ https: 'warning', 'url-absolute': 'pass', 'final-url-absolute': 'pass', 'url-fragment': 'warning' });
    expect(checks()).toMatchObject({ https: 'pass', 'url-fragment': 'pass' });
  });
  it('distinguishes redirect count, nonredirect statuses and absent Location', () => {
    expect(checks()['redirect-chain']).toBe('pass');
    for (const [length, status] of [[1, 'warning'], [2, 'warning'], [3, 'error']] as const) {
      const redirect_chain = Array.from({ length }, () => ({ url: 'https://example.test/a', status_code: 302, location: '/next' }));
      expect(checks({ redirect_chain })).toMatchObject({ 'redirect-chain': status, 'redirect-statuses': 'pass', 'redirect-locations': 'pass' });
    }
    for (const [status_code, location] of [[200, undefined], [400, ' ']] as const) {
      expect(checks({ redirect_chain: [{ url: 'https://example.test/a', status_code, location }] })).toMatchObject({ 'redirect-statuses': 'error', 'redirect-locations': 'warning' });
    }
  });
  it('retains absent legacy performance and verifies decoded-body/count consistency', () => {
    expect(checks()).toMatchObject({ 'http-performance': 'not_applicable', 'http-body-size': 'not_applicable', 'http-redirect-count': 'not_applicable' });
    const http_performance = { measured_at: '2026-10-04T00:00:00Z', method: 'GET', scope: 'native', response_headers_ms: 1, body_read_ms: 2, total_request_ms: 3, decoded_body_bytes: 0, redirect_hops: 0 };
    expect(checks({ http_performance })).toMatchObject({ 'http-performance': 'pass', 'http-body-size': 'pass', 'http-redirect-count': 'pass' });
    expect(checks({ http_performance: { ...http_performance, decoded_body_bytes: -1, redirect_hops: 1 } })).toMatchObject({ 'http-body-size': 'error', 'http-redirect-count': 'warning' });
  });
});
