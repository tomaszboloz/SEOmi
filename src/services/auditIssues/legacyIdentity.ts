import type { Issue } from '@/types';
import { accessibilityTranslationKeys } from './accessibilityKeys';

interface InferredIssueIdentity {
  code: string;
  params?: Record<string, string>;
}

export const inferLegacyIssueIdentity = (issue: Issue): InferredIssueIdentity | null => {
  const message = issue.message;
  const matches = (pattern: RegExp, code: string, params: Record<string, string> = {}): InferredIssueIdentity | null => {
    const result = message.match(pattern);
    return result ? { code, params: { ...params, ...(result.groups ?? {}) } } : null;
  };

  // Legacy snapshots may contain either the Polish backend prefix or a
  // previously localized/English prefix. The stable code is the portable
  // part of the record, so infer it independently of that prefix.
  const accessibilityCode = message.match(/(?:^|[^a-z0-9])(?<code>accessibility-[a-z0-9-]+):/i)?.groups?.code?.toLowerCase();
  if (accessibilityCode && accessibilityTranslationKeys[accessibilityCode]) {
    const params: Record<string, string> = {};
    const ratio = message.match(/(?<unlabeled>\d+)\s+(?:z|of)\s+(?<total>\d+)/i)?.groups;
    if (ratio) {
      params.unlabeled = ratio.unlabeled;
      params.total = ratio.total;
    }
    const count = message.match(/\b(?<count>\d+)\b/)?.groups?.count;
    if (count) params.count = count;
    return { code: accessibilityCode, params };
  }

  if (issue.category === 'MetaTags') {
    return matches(/^Missing page <title> tag$/, 'meta_title_missing')
      ?? matches(/^Page title is too short \((?<count>\d+) characters\)$/, 'meta_title_short')
      ?? matches(/^Page title is too long \((?<count>\d+) characters\), risks truncation in SERP$/, 'meta_title_long')
      ?? matches(/^Missing meta description tag$/, 'meta_description_missing')
      ?? matches(/^Meta description is too short \((?<count>\d+) characters\)$/, 'meta_description_short')
      ?? matches(/^Meta description is too long \((?<count>\d+) characters\)$/, 'meta_description_long')
      ?? matches(/^Missing canonical link tag$/, 'meta_canonical_missing')
      ?? matches(/^Canonical target returned HTTP (?<status>\d+)$/, 'meta_canonical_target')
      ?? matches(/^Page has 'noindex' in robots meta tag \(preventing indexing in Google\)$/, 'meta_robots_noindex');
  }
  if (issue.category === 'Technical') {
    return matches(/^Missing viewport meta tag \(Mobile usability failure\)$/, 'meta_viewport_missing')
      ?? matches(/^Page has noindex in the X-Robots-Tag response header$/, 'indexability_xrobots_noindex');
  }
  if (issue.category === 'Security') {
    return matches(/^Missing Content-Security-Policy \(CSP\) header$/, 'security_csp_missing')
      ?? matches(/^Missing Strict-Transport-Security \(HSTS\) header$/, 'security_hsts_missing')
      ?? matches(/^HSTS header is missing 'max-age'$/, 'security_hsts_invalid')
      ?? matches(/^Missing X-Frame-Options header \(Clickjacking vulnerability\)$/, 'security_xframe_missing')
      ?? matches(/^Missing X-Content-Type-Options header$/, 'security_xcontent_missing')
      ?? matches(/^Missing Referrer-Policy header$/, 'security_referrer_missing')
      ?? matches(/^Missing Permissions-Policy header$/, 'security_permissions_missing');
  }
  if (issue.category === 'Performance') {
    return matches(/^HTTP response returned non-200 status code: (?<status>\d+)$/, 'performance_http_status')
      ?? matches(/^Slow server response time: (?<ms>\d+)ms \(recommended < 800ms\)$/, 'performance_response_slow')
      ?? matches(/^Redirect chain contains (?<hops>\d+) hops, causing latency and crawling budget loss$/, 'performance_redirect_chain');
  }
  if (issue.category === 'Headings') {
    return matches(/^No H1 heading found on page$/, 'headings_h1_missing')
      ?? matches(/^Multiple H1 headings found \((?<count>\d+) total\)$/, 'headings_h1_multiple')
      ?? matches(/^Skipped heading level: H(?<previous>\d+) followed directly by H(?<level>\d+) \('(?<text>.*)'\)$/, 'headings_hierarchy_skip');
  }
  if (issue.category === 'Images') {
    return matches(/^(?<count>\d+) image\(s\) missing 'alt' descriptive text$/, 'images_alt_missing')
      ?? matches(/^(?<count>\d+) image\(s\) missing explicit width\/height dimensions \(CLS risk\)$/, 'images_dimensions_missing');
  }
  if (issue.category === 'Links') {
    return matches(/^(?<count>\d+) external link\(s\) use target='_blank' without rel='noopener noreferrer'$/, 'links_target_blank')
      ?? matches(/^(?<count>\d+) link destination\(s\) use HTTP on an HTTPS page; these are navigation links, not embedded mixed content$/, 'links_insecure');
  }
  return null;
};

