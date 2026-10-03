import { expect, it } from 'vitest';
import type { Issue } from '@/types';
import { inferLegacyIssueIdentity } from '@/services/auditIssues/legacyIdentity';

const cases: Array<[Issue['category'], string, string, Record<string, string>]> = [
  ['MetaTags', 'Missing page <title> tag', 'meta_title_missing', {}],
  ['MetaTags', 'Page title is too short (5 characters)', 'meta_title_short', { count: '5' }],
  ['MetaTags', 'Page title is too long (70 characters), risks truncation in SERP', 'meta_title_long', { count: '70' }],
  ['MetaTags', 'Missing meta description tag', 'meta_description_missing', {}],
  ['MetaTags', 'Meta description is too short (5 characters)', 'meta_description_short', { count: '5' }],
  ['MetaTags', 'Meta description is too long (200 characters)', 'meta_description_long', { count: '200' }],
  ['MetaTags', 'Missing canonical link tag', 'meta_canonical_missing', {}],
  ['MetaTags', 'Canonical target returned HTTP 404', 'meta_canonical_target', { status: '404' }],
  ['MetaTags', "Page has 'noindex' in robots meta tag (preventing indexing in Google)", 'meta_robots_noindex', {}],
  ['Technical', 'Missing viewport meta tag (Mobile usability failure)', 'meta_viewport_missing', {}],
  ['Technical', 'Page has noindex in the X-Robots-Tag response header', 'indexability_xrobots_noindex', {}],
  ['Security', 'Missing Content-Security-Policy (CSP) header', 'security_csp_missing', {}],
  ['Security', 'Missing Strict-Transport-Security (HSTS) header', 'security_hsts_missing', {}],
  ['Security', "HSTS header is missing 'max-age'", 'security_hsts_invalid', {}],
  ['Security', 'Missing X-Frame-Options header (Clickjacking vulnerability)', 'security_xframe_missing', {}],
  ['Security', 'Missing X-Content-Type-Options header', 'security_xcontent_missing', {}],
  ['Security', 'Missing Referrer-Policy header', 'security_referrer_missing', {}],
  ['Security', 'Missing Permissions-Policy header', 'security_permissions_missing', {}],
  ['Performance', 'HTTP response returned non-200 status code: 500', 'performance_http_status', { status: '500' }],
  ['Performance', 'Slow server response time: 900ms (recommended < 800ms)', 'performance_response_slow', { ms: '900' }],
  ['Performance', 'Redirect chain contains 3 hops, causing latency and crawling budget loss', 'performance_redirect_chain', { hops: '3' }],
  ['Headings', 'No H1 heading found on page', 'headings_h1_missing', {}],
  ['Headings', 'Multiple H1 headings found (2 total)', 'headings_h1_multiple', { count: '2' }],
  ['Headings', "Skipped heading level: H1 followed directly by H3 ('Title')", 'headings_hierarchy_skip', { previous: '1', level: '3', text: 'Title' }],
  ['Images', "2 image(s) missing 'alt' descriptive text", 'images_alt_missing', { count: '2' }],
  ['Images', '3 image(s) missing explicit width/height dimensions (CLS risk)', 'images_dimensions_missing', { count: '3' }],
  ['Links', "4 external link(s) use target='_blank' without rel='noopener noreferrer'", 'links_target_blank', { count: '4' }],
  ['Links', '5 link destination(s) use HTTP on an HTTPS page; these are navigation links, not embedded mixed content', 'links_insecure', { count: '5' }],
];
it.each(cases)('infers %s: %s', (category, message, code, params) => {
  expect(inferLegacyIssueIdentity({ category, message, severity: 'Warning' })).toEqual({ code, params });
});
it.each(['MetaTags', 'Technical', 'Security', 'Performance', 'Headings', 'Images', 'Links', 'OpenGraph'] as const)(
  'preserves unknown %s findings', category => {
    expect(inferLegacyIssueIdentity({ category, message: 'Future backend finding', severity: 'Info' })).toBeNull();
  },
);
it.each([
  ['Accessibility · accessibility-form-controls-unlabeled: 4 of 14 controls', 'accessibility-form-controls-unlabeled', { unlabeled: '4', total: '14', count: '4' }],
  ['Dostępność · accessibility-form-controls-unlabeled: 4 z 14', 'accessibility-form-controls-unlabeled', { unlabeled: '4', total: '14', count: '4' }],
  ['ACCESSIBILITY-DUPLICATE-ID: 2 duplicates', 'accessibility-duplicate-id', { count: '2' }],
  ['accessibility-document-language-missing: no language', 'accessibility-document-language-missing', {}],
])('infers accessibility evidence %s', (message, code, params) => {
  expect(inferLegacyIssueIdentity({ category: 'Technical', message, severity: 'Warning' })).toEqual({ code, params });
});
it('preserves unknown accessibility codes rather than inventing a translation', () => {
  expect(inferLegacyIssueIdentity({ category: 'Technical', severity: 'Warning', message: 'accessibility-future-code: unknown' })).toBeNull();
});
