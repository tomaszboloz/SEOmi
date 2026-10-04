import type { PageAuditData } from '@/types';
import i18n from '@/i18n';
import { check, evidence, present, absoluteHttp, LocalAuditCheck } from './auditChecksBase';

export const buildHttpAndUrlChecks = (audit: PageAuditData): LocalAuditCheck[] => {
  const finalUrl = audit.final_url || audit.url;
  const finalUrlIsHttps = /^https:\/\//i.test(finalUrl);
  const performance = audit.http_performance;

  return [
    check('http', 'httpIUrl', 'http', audit.http_status >= 200 && audit.http_status < 300 ? 'pass' : audit.http_status >= 300 && audit.http_status < 400 ? 'warning' : 'error', evidence('httpStatus', { status: audit.http_status })),
    check('https', 'httpIUrl', 'https', finalUrlIsHttps ? 'pass' : 'warning', finalUrlIsHttps ? evidence('httpsSecure') : evidence('httpsInsecure')),
    check('url-absolute', 'httpIUrl', 'url-absolute', absoluteHttp(audit.url) ? 'pass' : 'error', audit.url || evidence('missingRequestUrl')),
    check('final-url-absolute', 'httpIUrl', 'final-url-absolute', absoluteHttp(finalUrl) ? 'pass' : 'error', finalUrl || evidence('missingFinalUrl')),
    check('url-fragment', 'httpIUrl', 'url-fragment', audit.url.includes('#') ? 'warning' : 'pass', audit.url.includes('#') ? evidence('urlFragment') : evidence('noFragment')),
    check('redirect-chain', 'httpIUrl', 'redirect-chain', audit.redirect_chain.length === 0 ? 'pass' : audit.redirect_chain.length <= 2 ? 'warning' : 'error', audit.redirect_chain.length ? evidence('count', { count: audit.redirect_chain.length, unit: i18n.t('auditChecks.evidence.redirectUnit') }) : evidence('noRedirects')),
    check('redirect-statuses', 'httpIUrl', 'redirect-statuses', audit.redirect_chain.length === 0 || audit.redirect_chain.every((hop) => hop.status_code >= 300 && hop.status_code < 400) ? 'pass' : 'error', audit.redirect_chain.length ? audit.redirect_chain.map((hop) => `${hop.status_code}`).join(' → ') : evidence('notApplicable')),
    check('redirect-locations', 'httpIUrl', 'redirect-locations', audit.redirect_chain.length === 0 || audit.redirect_chain.every((hop) => present(hop.location)) ? 'pass' : 'warning', audit.redirect_chain.length ? evidence('redirectLocations', { withLocation: audit.redirect_chain.filter((hop) => present(hop.location)).length, total: audit.redirect_chain.length }) : evidence('notApplicable')),
    check('response-time', 'httpIUrl', 'response-time', audit.response_time_ms < 800 ? 'pass' : audit.response_time_ms < 2000 ? 'warning' : 'error', evidence('responseTime', { value: audit.response_time_ms })),
    check('response-time-fast', 'httpIUrl', 'response-time-fast', audit.response_time_ms < 300 ? 'pass' : 'warning', evidence('responseTime', { value: audit.response_time_ms })),
    check('response-time-known', 'httpIUrl', 'response-time-known', Number.isFinite(audit.response_time_ms) && audit.response_time_ms >= 0 ? 'pass' : 'error', String(audit.response_time_ms)),
    check('http-performance', 'httpIUrl', 'http-performance', performance ? 'pass' : 'not_applicable', performance ? `${performance.method} · ${performance.scope}` : evidence('legacyMeasurement')),
    check('http-body-size', 'httpIUrl', 'http-body-size', performance ? performance.decoded_body_bytes >= 0 ? 'pass' : 'error' : 'not_applicable', performance ? evidence('bodySize', { value: performance.decoded_body_bytes }) : evidence('missingData')),
    check('http-redirect-count', 'httpIUrl', 'http-redirect-count', performance ? performance.redirect_hops === audit.redirect_chain.length ? 'pass' : 'warning' : 'not_applicable', performance ? `${performance.redirect_hops}` : evidence('missingData')),
  ];
};

export const buildMetaAndIndexabilityChecks = (audit: PageAuditData): LocalAuditCheck[] => {
  const meta = audit.meta_tags;
  const indexability = audit.indexability;
  const viewport = meta.viewport?.trim() || '';
  const hasResponsiveViewport = /(?:^|[,;])\s*width\s*=\s*device-width(?:\s*[,;]|$)/i.test(viewport);
  const noindex = /(?:^|[\s,;])(noindex|none)(?:$|[\s,;])/i.test(meta.robots || '');
  const title = meta.title?.trim() || '';
  const description = meta.description?.trim() || '';

  return [
    check('title', 'metaIIndeksacja', 'title', title ? 'pass' : 'error', title || evidence('missingTitle')),
    check('title-length-min', 'metaIIndeksacja', 'title-length-min', !title ? 'not_applicable' : meta.title_length >= 20 ? 'pass' : 'warning', title ? evidence('countCharacters', { count: meta.title_length }) : evidence('missingTitle')),
    check('title-length-max', 'metaIIndeksacja', 'title-length-max', !title ? 'not_applicable' : meta.title_length <= 60 ? 'pass' : 'warning', title ? evidence('countCharacters', { count: meta.title_length }) : evidence('missingTitle')),
    check('title-trimmed', 'metaIIndeksacja', 'title-trimmed', !meta.title || meta.title === title ? 'pass' : 'warning', meta.title ? evidence('savedCharacters', { count: meta.title.length }) : evidence('missingTitle')),
    check('title-description-distinct', 'metaIIndeksacja', 'title-description-distinct', !title || !description ? 'not_applicable' : title.toLowerCase() !== description.toLowerCase() ? 'pass' : 'warning', title && description && title.toLowerCase() === description.toLowerCase() ? evidence('identicalValues') : evidence('differentValues')),
    check('description', 'metaIIndeksacja', 'description', description ? 'pass' : 'error', description || evidence('missingDescription')),
    check('description-length-min', 'metaIIndeksacja', 'description-length-min', !description ? 'not_applicable' : meta.description_length >= 70 ? 'pass' : 'warning', description ? evidence('countCharacters', { count: meta.description_length }) : evidence('missingDescription')),
    check('description-length-max', 'metaIIndeksacja', 'description-length-max', !description ? 'not_applicable' : meta.description_length <= 160 ? 'pass' : 'warning', description ? evidence('countCharacters', { count: meta.description_length }) : evidence('missingDescription')),
    check('viewport', 'metaIIndeksacja', 'viewport', !viewport ? 'error' : hasResponsiveViewport ? 'pass' : 'warning', !viewport ? evidence('missingViewport') : hasResponsiveViewport ? viewport : evidence('viewportInvalid', { value: viewport })),
    check('viewport-responsive', 'metaIIndeksacja', 'viewport-responsive', !viewport ? 'not_applicable' : hasResponsiveViewport ? 'pass' : 'warning', viewport || evidence('missingData')),
    check('viewport-no-scale-lock', 'metaIIndeksacja', 'viewport-no-scale-lock', !viewport ? 'not_applicable' : /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?/i.test(viewport) ? 'warning' : 'pass', viewport || evidence('missingData')),
    check('canonical', 'metaIIndeksacja', 'canonical', present(meta.canonical) ? 'pass' : 'warning', meta.canonical || evidence('missingCanonical')),
    check('canonical-absolute', 'metaIIndeksacja', 'canonical-absolute', !meta.canonical ? 'not_applicable' : absoluteHttp(meta.canonical) ? 'pass' : 'warning', meta.canonical || evidence('missingCanonical')),
    check('canonical-https', 'metaIIndeksacja', 'canonical-https', !meta.canonical ? 'not_applicable' : /^https:\/\//i.test(meta.canonical) ? 'pass' : 'warning', meta.canonical || evidence('missingCanonical')),
    check('robots-present', 'metaIIndeksacja', 'robots-present', present(meta.robots) ? 'pass' : 'not_applicable', meta.robots || evidence('missingRobots')),
    check('robots-indexable', 'metaIIndeksacja', 'robots-indexable', !meta.robots ? 'not_applicable' : noindex ? 'error' : 'pass', meta.robots || evidence('missingDirective')),
    check('charset', 'metaIIndeksacja', 'charset', !meta.charset ? 'not_applicable' : /utf-?8/i.test(meta.charset) ? 'pass' : 'warning', meta.charset || evidence('missingCharset')),
    check('author', 'metaIIndeksacja', 'author', present(meta.author) ? 'pass' : 'not_applicable', meta.author || evidence('notDeclared')),
    check('generator', 'metaIIndeksacja', 'generator', present(meta.generator) ? 'warning' : 'pass', meta.generator || evidence('noGenerator')),
    check('indexability', 'metaIIndeksacja', 'indexability', indexability ? indexability.status === 'indexable' ? 'pass' : indexability.status === 'blocked' ? 'error' : 'warning' : 'not_applicable', indexability ? `${indexability.status}${indexability.reasons.length ? ` · ${indexability.reasons.join(' ')}` : ''}` : evidence('missingVerdict')),
    check('indexability-canonical-match', 'metaIIndeksacja', 'indexability-canonical-match', !indexability ? 'not_applicable' : indexability.canonical_matches_final_url === true ? 'pass' : indexability.canonical_matches_final_url === false ? 'warning' : 'not_applicable', indexability?.canonical_matches_final_url === true ? evidence('canonicalFinal') : indexability?.canonical_matches_final_url === false ? evidence('canonicalOther') : evidence('missingEvidence')),
    check('canonical-target-status', 'metaIIndeksacja', 'canonical-target-status', !indexability?.canonical_target_checked ? 'not_applicable' : (indexability.canonical_target_status || 0) >= 200 && (indexability.canonical_target_status || 0) < 400 ? 'pass' : 'error', indexability?.canonical_target_checked ? evidence('httpStatus', { status: indexability.canonical_target_status || i18n.t('auditProblems.unknown') }) : evidence('targetNotChecked')),
  ];
};
