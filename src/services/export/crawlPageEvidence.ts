import type { CrawlRunRecord, CrawledSocialResourceCheck } from '@/types';
import { exportText } from './csv';
import i18n from '@/i18n';

export const observedHttpStatus = (status: number | null | undefined): string => status === 0 || status == null
  ? exportText('statuses.noResponse') : exportText('statuses.http', { status });

export const socialResourceStatus = (check: CrawledSocialResourceCheck): string => {
  if (!check.checked_in_run) return exportText('statuses.notChecked');
  if (check.request_error_kind) return exportText('statuses.requestError', { kind: check.request_error_kind });
  return [
    observedHttpStatus(check.http_status),
    check.content_length == null ? null : exportText('statuses.bytes', { value: check.content_length }),
    check.intrinsic_width && check.intrinsic_height ? `${check.intrinsic_width}x${check.intrinsic_height} (${check.dimensions_source || exportText('statuses.intrinsic')})` : null,
    check.content_type || null,
  ].filter(Boolean).join('; ');
};
export const socialDeclarations = (page: CrawlRunRecord['result']['pages'][number], prefix: 'og:' | 'twitter:') =>
  (page.social_meta_tags || []).filter((tag) => tag.key.startsWith(prefix))
    .map((tag) => `${tag.key}: ${tag.content === undefined || tag.content === null ? exportText('statuses.missingContent') : tag.content}${tag.resource_check ? ` [${socialResourceStatus(tag.resource_check)}]` : ''}`)
    .join(' | ');
export const faviconDeclarations = (page: CrawlRunRecord['result']['pages'][number]) =>
  (page.favicon_metadata || []).map((favicon) => [
    favicon.href,
    favicon.rel ? i18n.t('crawl.social.faviconRel', { value: favicon.rel }) : null,
    favicon.declared_type ? i18n.t('crawl.social.faviconType', { value: favicon.declared_type }) : null,
    favicon.declared_sizes ? i18n.t('crawl.social.faviconSizes', { value: favicon.declared_sizes }) : null,
    favicon.inferred_format ? i18n.t('crawl.social.faviconFormat', { value: favicon.inferred_format }) : null,
  ].filter(Boolean).join('; ')).join(' | ');
export const canonicalTargets = (page: CrawlRunRecord['result']['pages'][number]) =>
  (page.canonical_targets || []).map((target) => {
    const status = !target.checked_in_run
      ? exportText('statuses.notChecked')
      : observedHttpStatus(target.http_status);
    return `${target.relation}: ${target.url} (${status})`;
  }).join(' | ');
export const clientRedirects = (page: CrawlRunRecord['result']['pages'][number]) =>
  (page.client_redirects || []).map((item) => {
    const mechanismKey: Record<string, string> = {
      'meta-refresh': 'crawlDeepUi.mechanismMetaRefresh',
      'http-refresh': 'crawlDeepUi.mechanismHttpRefresh',
      javascript: 'crawlDeepUi.mechanismJavascript',
      'javascript-inline': 'crawlDeepUi.mechanismJavascriptInline',
    };
    const mechanism = mechanismKey[item.source]
      ? i18n.t(mechanismKey[item.source], { defaultValue: item.source })
      : item.source;
    return `${mechanism}; delay=${item.delay_seconds ?? exportText('statuses.unknown')}s; target=${item.target_url || exportText('statuses.unresolved')}; declaration=${item.declaration}`;
  }).join(' | ');
export const robotsDecision = (page: CrawlRunRecord['result']['pages'][number]) => {
  const decision = page.robots_decision;
  if (!decision) return '';
  return `${decision.indexability}; ${decision.link_following}; directives=${(decision.directives || []).join(', ') || exportText('statuses.defaults')}; sources=${(decision.sources || []).join(', ') || exportText('statuses.none')}; headers=${decision.response_headers_available ? exportText('statuses.available') : exportText('statuses.unavailable')}`;
};
export const paginationLinks = (page: CrawlRunRecord['result']['pages'][number]) =>
  (page.pagination_links || []).map((item) => {
    const status = !item.checked_in_run ? exportText('statuses.notChecked') : observedHttpStatus(item.http_status);
    const queryChanges = item.query_parameter_changes.length ? item.query_parameter_changes.join(', ') : exportText('statuses.noQueryChanges');
    const reciprocal = item.reciprocal_in_run === undefined || item.reciprocal_in_run === null
      ? exportText('statuses.reciprocalUnknown')
      : item.reciprocal_in_run ? exportText('statuses.reciprocalYes') : exportText('statuses.reciprocalMissing');
    const reciprocalSuffix = item.reciprocal_in_run === undefined ? '' : `; ${reciprocal}`;
    return `${item.relation}: ${item.target_url} (${status}; ${queryChanges}${reciprocalSuffix})`;
  }).join(' | ');
