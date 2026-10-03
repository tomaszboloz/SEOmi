import { expect, it } from 'vitest';
import { observedHttpStatus, socialResourceStatus, socialDeclarations, faviconDeclarations, canonicalTargets, clientRedirects, robotsDecision, paginationLinks } from '@/services/export/crawlPageEvidence';
import { crawlRun } from './fixtures/export';
import i18n from '@/i18n';
const page = crawlRun.result.pages[0];
const text = (key: string, vars?: Record<string, unknown>) => i18n.t(`exportUi.${key}`, vars);
it.each([undefined, null, 0])('keeps unavailable HTTP response evidence distinct from a status code %j', value => {
  expect(observedHttpStatus(value)).toBe(text('statuses.noResponse'));
});
it('preserves observed HTTP responses, including non-success status codes', () => {
  expect(observedHttpStatus(404)).toBe(text('statuses.http', { status: 404 }));
});
it('reports social-resource scope, request failure, observed zero bytes and intrinsic geometry', () => {
  const base = { url: 'https://site.test/image', checked_in_run: true };
  expect(socialResourceStatus({ ...base, checked_in_run: false, http_status: 200 })).toBe(text('statuses.notChecked'));
  expect(socialResourceStatus({ ...base, request_error_kind: 'timeout' })).toBe(text('statuses.requestError', { kind: 'timeout' }));
  expect(socialResourceStatus(base)).toBe(text('statuses.noResponse'));
  expect(socialResourceStatus({ ...base, http_status: 200, content_length: 0, intrinsic_width: 640, intrinsic_height: 480, dimensions_source: 'decoded', content_type: 'image/png' }))
    .toBe(`${text('statuses.http', { status: 200 })}; ${text('statuses.bytes', { value: 0 })}; 640x480 (decoded); image/png`);
  expect(socialResourceStatus({ ...base, intrinsic_width: 16, intrinsic_height: 16 })).toContain(`16x16 (${text('statuses.intrinsic')})`);
});
it('preserves missing versus empty social content and includes checks only when recorded', () => {
  const data = { ...page, social_meta_tags: [
    { key: 'og:title', content: '' }, { key: 'og:description', content: null }, { key: 'og:image' },
    { key: 'twitter:title', content: 'Observed' },
    { key: 'og:image:url', content: 'https://site.test/image', resource_check: { url: 'https://site.test/image', checked_in_run: false } },
  ] } as never;
  expect(socialDeclarations(data, 'og:')).toContain(`og:description: ${text('statuses.missingContent')}`);
  expect(socialDeclarations(data, 'og:')).toContain('og:title:  |');
  expect(socialDeclarations(data, 'og:')).toContain(`[${text('statuses.notChecked')}]`);
  expect(socialDeclarations(data, 'twitter:')).toBe('twitter:title: Observed');
  expect(socialDeclarations(page, 'og:')).toBe('');
});
it('includes only observed favicon declarations', () => {
  expect(faviconDeclarations(page)).toBe('');
  expect(faviconDeclarations({ ...page, favicon_metadata: [{ href: '/favicon.ico', rel: '' }] })).toBe('/favicon.ico');
  const output = faviconDeclarations({ ...page, favicon_metadata: [{ href: '/favicon.ico', rel: 'icon', declared_type: 'image/x-icon', declared_sizes: '16x16', inferred_format: 'ICO' }] });
  for (const value of ['/favicon.ico', 'icon', 'image/x-icon', '16x16', 'ICO']) expect(output).toContain(value);
});
it('formats only checked canonical status evidence and preserves unverified scope', () => {
  const output = canonicalTargets({ ...page, canonical_targets: [
    { url: 'https://site.test/unchecked', relation: 'same-host', checked_in_run: false },
    { url: 'https://site.test/missing', relation: 'same-host', checked_in_run: true },
    { url: 'https://site.test/found', relation: 'same-host', checked_in_run: true, http_status: 200 },
  ] } as never);
  expect(output).toContain(text('statuses.notChecked')); expect(output).toContain(text('statuses.noResponse'));
  expect(output).toContain(text('statuses.http', { status: 200 })); expect(canonicalTargets(page)).toBe('');
});
it('preserves known and future redirect mechanisms, observed zero delay and unresolved targets', () => {
  const known = ['meta-refresh', 'http-refresh', 'javascript', 'javascript-inline'];
  for (const source of known) expect(clientRedirects({ ...page, client_redirects: [{ source, delay_seconds: 0, target_url: 'https://site.test/next', declaration: 'Observed' }] } as never)).toContain('delay=0s; target=https://site.test/next; declaration=Observed');
  expect(clientRedirects({ ...page, client_redirects: [{ source: 'future-kind', declaration: 'Observed' }] } as never))
    .toBe(`future-kind; delay=${text('statuses.unknown')}s; target=${text('statuses.unresolved')}; declaration=Observed`);
  expect(clientRedirects(page)).toBe('');
});
it('keeps default and observed robots decisions explicitly distinguishable', () => {
  expect(robotsDecision(page)).toBe('');
  const base = { indexability: 'index', link_following: 'follow', response_headers_available: false };
  expect(robotsDecision({ ...page, robots_decision: base } as never)).toBe(`index; follow; directives=${text('statuses.defaults')}; sources=${text('statuses.none')}; headers=${text('statuses.unavailable')}`);
  expect(robotsDecision({ ...page, robots_decision: { ...base, directives: ['noindex'], sources: ['meta'], response_headers_available: true } } as never)).toContain(`directives=noindex; sources=meta; headers=${text('statuses.available')}`);
});
it('reports pagination checks, query changes and all reciprocal evidence states', () => {
  const rows = [
    { checked_in_run: false, reciprocal_in_run: undefined, query_parameter_changes: [] },
    { checked_in_run: true, http_status: null, reciprocal_in_run: null, query_parameter_changes: [] },
    { checked_in_run: true, http_status: 200, reciprocal_in_run: true, query_parameter_changes: ['page: 1 → 2'] },
    { checked_in_run: true, http_status: 404, reciprocal_in_run: false, query_parameter_changes: [] },
  ].map(value => ({ relation: 'next', target_url: 'https://site.test/next', ...value }));
  const output = paginationLinks({ ...page, pagination_links: rows } as never);
  for (const key of ['notChecked', 'noResponse', 'noQueryChanges', 'reciprocalUnknown', 'reciprocalYes', 'reciprocalMissing']) expect(output).toContain(text(`statuses.${key}`));
  expect(output).toContain('page: 1 → 2'); expect(paginationLinks(page)).toBe('');
});
