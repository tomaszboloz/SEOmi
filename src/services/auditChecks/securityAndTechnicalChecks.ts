import type { PageAuditData } from '@/types';
import i18n from '@/i18n';
import { check, evidence, present, absoluteHttp, uniqueCount, LocalAuditCheck } from './auditChecksBase';

export const buildSecurityChecks = (audit: PageAuditData): LocalAuditCheck[] => {
  const security = audit.security_headers;
  const transport = audit.transport_security;
  const finalUrl = audit.final_url || audit.url;
  const finalUrlIsHttps = /^https:\/\//i.test(finalUrl);

  const allCookiesSecure = transport ? transport.cookies.every((cookie) => cookie.secure) : false;
  const allCookiesHttpOnly = transport ? transport.cookies.every((cookie) => cookie.http_only) : false;
  const allCookiesSameSite = transport ? transport.cookies.every((cookie) => present(cookie.same_site)) : false;

  return [
    check('security', 'bezpieczenstwo', 'security', security.score >= 80 ? 'pass' : security.score >= 50 ? 'warning' : 'error', `${security.score}/100`),
    check('security-hsts', 'bezpieczenstwo', 'security-hsts', !finalUrlIsHttps ? 'not_applicable' : present(security.strict_transport_security) ? 'pass' : 'warning', security.strict_transport_security || evidence('missingHsts')),
    check('security-csp', 'bezpieczenstwo', 'security-csp', present(security.content_security_policy) ? 'pass' : 'warning', security.content_security_policy || evidence('missingCsp')),
    check('security-xfo', 'bezpieczenstwo', 'security-xfo', present(security.x_frame_options) ? 'pass' : 'warning', security.x_frame_options || evidence('missingXfo')),
    check('security-xcto', 'bezpieczenstwo', 'security-xcto', present(security.x_content_type_options) ? 'pass' : 'warning', security.x_content_type_options || evidence('missingXcto')),
    check('security-referrer', 'bezpieczenstwo', 'security-referrer', present(security.referrer_policy) ? 'pass' : 'warning', security.referrer_policy || evidence('missingReferrer')),
    check('security-permissions', 'bezpieczenstwo', 'security-permissions', present(security.permissions_policy) ? 'pass' : 'not_applicable', security.permissions_policy || evidence('notDeclared')),
    check('security-coop', 'bezpieczenstwo', 'security-coop', present(security.cross_origin_opener_policy) ? 'pass' : 'not_applicable', security.cross_origin_opener_policy || evidence('notDeclared')),
    check('security-corp', 'bezpieczenstwo', 'security-corp', present(security.cross_origin_resource_policy) ? 'pass' : 'not_applicable', security.cross_origin_resource_policy || evidence('notDeclared')),
    check('security-server-disclosure', 'bezpieczenstwo', 'security-server-disclosure', present(security.server) ? 'warning' : 'pass', security.server || evidence('missingServer')),
    check('security-powered-by', 'bezpieczenstwo', 'security-powered-by', present(security.x_powered_by) ? 'warning' : 'pass', security.x_powered_by || evidence('missingPoweredBy')),
    check('security-cookies', 'bezpieczenstwo', 'security-cookies', !transport || transport.cookies.length === 0 ? 'not_applicable' : allCookiesSecure && allCookiesHttpOnly && allCookiesSameSite ? 'pass' : 'warning', !transport || transport.cookies.length === 0 ? evidence('noCookies') : evidence('cookiesFlags', { count: transport.cookies.length, secure: allCookiesSecure ? i18n.t('auditChecks.evidence.yes') : i18n.t('auditChecks.evidence.no'), httpOnly: allCookiesHttpOnly ? i18n.t('auditChecks.evidence.yes') : i18n.t('auditChecks.evidence.no'), sameSite: allCookiesSameSite ? i18n.t('auditChecks.evidence.yes') : i18n.t('auditChecks.evidence.no') })),
  ];
};

export const buildStructuredDataChecks = (audit: PageAuditData): LocalAuditCheck[] => {
  const structured = audit.structured_data || [];
  const structuredFindings = structured.flatMap((item) => item.validation_issues || []);
  const structuredErrors = structuredFindings.filter((issue) => issue.severity === 'error').length;
  const structuredWarnings = structuredFindings.filter((issue) => issue.severity === 'warning').length;

  return [
    check('structured-present', 'daneStrukturalne', 'structured-present', structured.length > 0 ? 'pass' : 'warning', structured.length ? evidence('countDeclarations', { count: structured.length }) : evidence('noStructured')),
    check('structured-errors', 'daneStrukturalne', 'structured-errors', structured.length === 0 ? 'not_applicable' : structuredErrors === 0 ? 'pass' : 'error', structured.length ? evidence('countErrors', { count: structuredErrors }) : evidence('noDeclarations')),
    check('structured-warnings', 'daneStrukturalne', 'structured-warnings', structured.length === 0 ? 'not_applicable' : structuredWarnings === 0 ? 'pass' : 'warning', structured.length ? evidence('countWarnings', { count: structuredWarnings }) : evidence('noDeclarations')),
    check('structured-format-coverage', 'daneStrukturalne', 'structured-format-coverage', structured.every((item) => ['JSON-LD', 'Microdata', 'RDFa'].includes(item.format)) ? 'pass' : 'warning', evidence('countFormats', { count: uniqueCount(structured.map((item) => item.format)) })),
    check('structured-type-coverage', 'daneStrukturalne', 'structured-type-coverage', structured.length === 0 ? 'not_applicable' : structured.every((item) => present(item.data_type)) ? 'pass' : 'warning', `${structured.filter((item) => present(item.data_type)).length}/${structured.length}`),
    check('structured-jsonld-valid', 'daneStrukturalne', 'structured-jsonld-valid', structured.filter((item) => item.format === 'JSON-LD').every((item) => item.content && typeof item.content === 'object') ? 'pass' : structured.some((item) => item.format === 'JSON-LD') ? 'warning' : 'not_applicable', evidence('localShapeCheck')),
    check('structured-unique-types', 'daneStrukturalne', 'structured-unique-types', structured.length === 0 ? 'not_applicable' : uniqueCount(structured.map((item) => item.data_type)) === structured.length ? 'pass' : 'warning', evidence('countUniqueTypes', { count: uniqueCount(structured.map((item) => item.data_type)) })),
    check('structured-finding-paths', 'daneStrukturalne', 'structured-finding-paths', structuredFindings.every((issue) => issue.path || issue.message) ? 'pass' : 'warning', evidence('countFindings', { count: structuredFindings.length })),
  ];
};

export const buildTechnicalChecks = (audit: PageAuditData): LocalAuditCheck[] => {
  const technical = audit.technical || { hreflang_tags: [] };
  const hreflangs = technical.hreflang_tags || [];
  const faviconCount = technical.favicons?.length || (technical.favicon ? 1 : 0);
  const duplicateHreflang = hreflangs.length - uniqueCount(hreflangs.map((tag) => tag.hreflang));

  return [
    check('technical-content-type', 'techniczne', 'technical-content-type', present(technical.content_type) ? 'pass' : 'warning', technical.content_type || evidence('missingContentType')),
    check('technical-favicon', 'techniczne', 'technical-favicon', faviconCount > 0 ? 'pass' : 'warning', faviconCount ? evidence('countVariants', { count: faviconCount }) : evidence('missingFavicon')),
    check('technical-favicon-absolute', 'techniczne', 'technical-favicon-absolute', technical.favicons?.length ? technical.favicons.every((item) => present(item.href)) ? 'pass' : 'warning' : technical.favicon ? 'pass' : 'not_applicable', technical.favicon || evidence('countVariants', { count: faviconCount })),
    check('technical-robots-url', 'techniczne', 'technical-robots-url', technical.robots_txt_url ? 'pass' : 'not_applicable', technical.robots_txt_url || evidence('robotsUrlMissing')),
    check('technical-sitemap-url', 'techniczne', 'technical-sitemap-url', technical.sitemap_url ? 'pass' : 'not_applicable', technical.sitemap_url || evidence('sitemapUrlMissing')),
    check('technical-hreflang', 'techniczne', 'technical-hreflang', hreflangs.length === 0 ? 'not_applicable' : hreflangs.every((tag) => present(tag.href)) ? 'pass' : 'warning', hreflangs.length ? `${hreflangs.filter((tag) => present(tag.href)).length}/${hreflangs.length}` : evidence('missingHreflang')),
    check('technical-hreflang-unique', 'techniczne', 'technical-hreflang-unique', hreflangs.length === 0 ? 'not_applicable' : duplicateHreflang === 0 ? 'pass' : 'warning', evidence('countDuplicates', { count: duplicateHreflang })),
    check('technical-hreflang-http', 'techniczne', 'technical-hreflang-http', hreflangs.length === 0 ? 'not_applicable' : hreflangs.every((tag) => absoluteHttp(tag.href)) ? 'pass' : 'warning', `${hreflangs.filter((tag) => absoluteHttp(tag.href)).length}/${hreflangs.length}`),
    check('technical-technology-signals', 'techniczne', 'technical-technology-signals', !technical.technology_signals?.length ? 'not_applicable' : technical.technology_signals.every((signal) => present(signal.name) && present(signal.evidence)) ? 'pass' : 'warning', evidence('countSignals', { count: technical.technology_signals?.length || 0 })),
    check('technical-technology-confidence', 'techniczne', 'technical-technology-confidence', !technical.technology_signals?.length ? 'not_applicable' : technical.technology_signals.every((signal) => signal.confidence === 'confirmed' || signal.confidence === 'heuristic') ? 'pass' : 'warning', evidence('confirmedSignals', { count: technical.technology_signals?.filter((signal) => signal.confidence === 'confirmed').length || 0 })),
  ];
};
