import { readResponseTextLimited, requestPinnedPublicTarget, validatePublicTarget } from './httpSafety.js';
import type { PublicAuditOptions, PublicAuditResult } from './auditTypes.js';
import { assertScope, validatePublicScopeOptions } from './auditScope.js';
import { extract, extractPublicLinks, extractSemanticSignals } from './auditSemantic.js';

const MAX_BODY_BYTES = 5 * 1024 * 1024;

export const auditPublicUrl = async (value: string, timeoutMs: number, options: PublicAuditOptions = {}): Promise<PublicAuditResult> => {
  validatePublicScopeOptions(options);
  let target = await validatePublicTarget(value);
  assertScope(target.url, options);
  const redirects: string[] = [];
  const started = performance.now();
  for (let step = 0; step <= 5; step += 1) {
    const response = await requestPinnedPublicTarget(target, timeoutMs);
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      redirects.push(target.url.toString());
      const nextUrl = new URL(response.headers.get('location')!, target.url).toString();
      await response.body?.cancel();
      target = await validatePublicTarget(nextUrl);
      assertScope(target.url, options);
      continue;
    }
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_BODY_BYTES) throw new Error(`Response body exceeds ${MAX_BODY_BYTES} bytes.`);
    const { text: body, truncated: bodyTruncated } = await readResponseTextLimited(response, MAX_BODY_BYTES);
    const contentType = response.headers.get('content-type')?.toLocaleLowerCase() || '';
    const isHtml = !contentType || contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
    const meta = (name: string) => new RegExp(`<meta[^>]+(?:name|property)=["']${name.replace(':', '\\:')}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name.replace(':', '\\:')}["']`, 'gi');
    const firstMeta = (name: string) => extract(body, meta(name)).at(0) || null;
    const discovered = extractPublicLinks(body, target.url);
    const semantic = bodyTruncated || !isHtml ? { terms: [], links: [], source: 'unavailable' as const } : extractSemanticSignals(body, target.url);
    return {
      requested_url: value,
      final_url: target.url.toString(),
      status: response.status,
      response_body_truncated: bodyTruncated,
      response_time_ms: Math.round(performance.now() - started),
      redirects,
      title: extract(body, /<title[^>]*>([\s\S]*?)<\/title>/gi).at(0) || null,
      meta_description: firstMeta('description'),
      canonical: extract(body, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/gi).at(0) || null,
      robots: firstMeta('robots'),
      open_graph: Object.fromEntries(['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map((name) => [name, firstMeta(name)])),
      headings: Object.fromEntries([1, 2, 3, 4, 5, 6].map((level) => [`h${level}`, extract(body, new RegExp(`<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi'))])),
      security_headers: Object.fromEntries(['strict-transport-security', 'content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy'].map((header) => [header, response.headers.get(header)])),
      discovered_links: discovered.links,
      discovered_links_truncated: discovered.truncated,
      semantic_terms: semantic.terms,
      semantic_links: semantic.links,
      semantic_content_source: semantic.source,
    };
  }
  throw new Error('Redirect limit exceeded.');
};
