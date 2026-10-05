import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { buildHttpAndUrlChecks, buildMetaAndIndexabilityChecks } from '@/services/auditChecks/httpAndMetaChecks';
import type { PageAuditData } from '@/types';

type Meta = Record<string, unknown>;
const baseMeta = { title: 'A sufficiently long page title', title_length: 30, description: 'd'.repeat(100), description_length: 100, viewport: 'width=device-width, initial-scale=1', canonical: 'https://a.test/', robots: '', charset: 'utf-8', author: '', generator: '' };
const page = (overrides: Record<string, unknown> = {}, meta: Meta = {}) => ({
  url: 'https://a.test/', final_url: 'https://a.test/', http_status: 200, response_time_ms: 120, redirect_chain: [], http_performance: { method: 'GET', scope: 'headers', decoded_body_bytes: 1024, redirect_hops: 0 },
  meta_tags: { ...baseMeta, ...meta }, indexability: undefined, ...overrides,
}) as unknown as PageAuditData;
const statusOf = (checks: ReturnType<typeof buildHttpAndUrlChecks>, id: string) => checks.find((entry) => entry.id === id)?.status;
const http = (audit: PageAuditData, id: string) => statusOf(buildHttpAndUrlChecks(audit), id);
const meta = (audit: PageAuditData, id: string) => statusOf(buildMetaAndIndexabilityChecks(audit), id);
const hop = (status_code: number, location?: string) => ({ url: 'https://a.test/x', status_code, location });

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('HTTP and URL checks', () => {
  it.each([[200, 'pass'], [204, 'pass'], [301, 'warning'], [399, 'warning'], [404, 'error'], [500, 'error'], [199, 'error']])('classifies status %s as %s', (status, expected) => {
    expect(http(page({ http_status: status }), 'http')).toBe(expected);
  });

  it('flags insecure, relative and fragment URLs', () => {
    expect(http(page({ final_url: 'http://a.test/' }), 'https')).toBe('warning');
    expect(http(page({ url: '/relative', final_url: '/relative' }), 'url-absolute')).toBe('error');
    expect(http(page({ url: '/relative', final_url: '/relative' }), 'final-url-absolute')).toBe('error');
    expect(http(page({ url: 'https://a.test/#top' }), 'url-fragment')).toBe('warning');
    expect(http(page({ url: 'https://a.test/', final_url: '' }), 'https')).toBe('pass');
  });

  it.each([[0, 'pass'], [1, 'warning'], [2, 'warning'], [3, 'error']])('rates a %s-hop redirect chain as %s', (hops, expected) => {
    expect(http(page({ redirect_chain: Array.from({ length: hops }, () => hop(301, '/n')) }), 'redirect-chain')).toBe(expected);
  });

  it('validates redirect statuses and locations only when there is a chain', () => {
    expect(http(page(), 'redirect-statuses')).toBe('pass');
    expect(http(page({ redirect_chain: [hop(301, '/a'), hop(302, '/b')] }), 'redirect-statuses')).toBe('pass');
    expect(http(page({ redirect_chain: [hop(301, '/a'), hop(200, '/b')] }), 'redirect-statuses')).toBe('error');
    expect(http(page({ redirect_chain: [hop(301, '/a'), hop(302)] }), 'redirect-locations')).toBe('warning');
    expect(http(page({ redirect_chain: [hop(301, '/a')] }), 'redirect-locations')).toBe('pass');
  });

  it.each([[0, 'pass', 'pass'], [299, 'pass', 'pass'], [300, 'pass', 'warning'], [799, 'pass', 'warning'], [800, 'warning', 'warning'], [1999, 'warning', 'warning'], [2000, 'error', 'warning']])('rates %s ms as %s (fast check: %s)', (ms, slow, fast) => {
    const audit = page({ response_time_ms: ms });
    expect(http(audit, 'response-time')).toBe(slow);
    expect(http(audit, 'response-time-fast')).toBe(fast);
  });

  it('requires a finite non-negative response time', () => {
    for (const bad of [Number.NaN, -1, Infinity]) expect(http(page({ response_time_ms: bad }), 'response-time-known')).toBe('error');
    expect(http(page({ response_time_ms: 0 }), 'response-time-known')).toBe('pass');
  });

  it('marks native measurement checks not applicable for legacy audits and compares hop counts', () => {
    const legacy = page({ http_performance: undefined });
    for (const id of ['http-performance', 'http-body-size', 'http-redirect-count']) expect(http(legacy, id)).toBe('not_applicable');
    expect(http(page({ http_performance: { method: 'GET', scope: 's', decoded_body_bytes: -1, redirect_hops: 2 } }), 'http-body-size')).toBe('error');
    expect(http(page({ http_performance: { method: 'GET', scope: 's', decoded_body_bytes: 0, redirect_hops: 2 } }), 'http-redirect-count')).toBe('warning');
    expect(http(page(), 'http-redirect-count')).toBe('pass');
  });
});

describe('title and description checks', () => {
  it('requires a title and checks its length and trimming', () => {
    expect(meta(page({}, { title: '  ', title_length: 0 }), 'title')).toBe('error');
    expect(meta(page({}, { title: '', title_length: 0 }), 'title-length-min')).toBe('not_applicable');
    expect(meta(page({}, { title: 'Short', title_length: 5 }), 'title-length-min')).toBe('warning');
    expect(meta(page({}, { title_length: 20 }), 'title-length-min')).toBe('pass');
    expect(meta(page({}, { title_length: 61 }), 'title-length-max')).toBe('warning');
    expect(meta(page({}, { title_length: 60 }), 'title-length-max')).toBe('pass');
    expect(meta(page({}, { title: ' padded title here ' }), 'title-trimmed')).toBe('warning');
    expect(meta(page({}, { title: '' }), 'title-trimmed')).toBe('pass');
  });

  it('compares title and description case-insensitively and checks description length', () => {
    expect(meta(page({}, { title: 'Same Text', description: 'same text' }), 'title-description-distinct')).toBe('warning');
    expect(meta(page({}, { description: '' }), 'title-description-distinct')).toBe('not_applicable');
    expect(meta(page(), 'title-description-distinct')).toBe('pass');
    expect(meta(page({}, { description: '' }), 'description')).toBe('error');
    expect(meta(page({}, { description: '', description_length: 0 }), 'description-length-min')).toBe('not_applicable');
    expect(meta(page({}, { description_length: 69 }), 'description-length-min')).toBe('warning');
    expect(meta(page({}, { description_length: 161 }), 'description-length-max')).toBe('warning');
    expect(meta(page({}, { description_length: 160 }), 'description-length-max')).toBe('pass');
  });
});
