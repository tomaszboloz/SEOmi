import { BacklinkGapReport, CrawlRunRecord, CrawledSocialResourceCheck, PageAuditData } from '@/types';
import { invokeTauriCommand } from '@/services/tauri';
import type { CrawlReportTemplate, ReportTemplateSection } from '@/services/reportTemplates';
import { buildCrawlResourceInventory } from '@/services/crawlResources';
import i18n from '@/i18n';

const spreadsheetSafe = (value: unknown): string => {
  const text = String(value ?? '');
  return /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
};

const escapeCsv = (value: unknown): string => `"${spreadsheetSafe(value).replaceAll('"', '""')}"`;

const csv = (rows: unknown[][]): string => rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
const exportText = (key: string, variables?: Record<string, unknown>): string => i18n.t(`exportUi.${key}`, variables);
const exportHeaders = (key: string): string[] => {
  const value = i18n.t(`exportUi.headers.${key}`, { returnObjects: true });
  return Array.isArray(value) ? value.map(String) : [];
};

export const auditCsv = (audit: PageAuditData): string => {
  const fields = exportHeaders('auditFields');
  const rows = [
    [fields[0], audit.final_url], [fields[1], audit.timestamp], [fields[2], audit.http_status],
    [fields[3], audit.response_time_ms], [fields[4], audit.health_score], [fields[5], audit.meta_tags.title || ''],
    [fields[6], audit.meta_tags.description || ''], [fields[7], audit.meta_tags.canonical || ''],
    [fields[8], audit.headings.h1_count], [fields[9], audit.images.length], [fields[10], audit.links.total_links],
    [fields[11], audit.security_headers.score],
  ];
  const issues = audit.issues.map((issue) => [exportText('labels.issue'), issue.severity, issue.category, issue.message, issue.recommendation || '']);
  return [exportHeaders('auditMain'), ...rows, [], exportHeaders('auditIssues'), ...issues]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\r\n');
};

const downloadBlob = (filename: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  let anchor: HTMLAnchorElement | undefined;
  try {
    anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor?.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
};

export const downloadText = (filename: string, text: string, mimeType: string): void =>
  downloadBlob(filename, new Blob([text], { type: `${mimeType};charset=utf-8` }));

const reportFilename = (audit: PageAuditData, extension: 'json' | 'csv' | 'pdf'): string => {
  const host = new URL(audit.final_url).hostname.replace(/[^a-z0-9.-]/gi, '-');
  const date = audit.timestamp.slice(0, 10);
  return `seomi-audit-${host}-${date}.${extension}`;
};

export const downloadAuditJson = (audit: PageAuditData): void => downloadText(reportFilename(audit, 'json'), JSON.stringify(audit, null, 2), 'application/json');
export const downloadAuditCsv = (audit: PageAuditData): void => downloadText(reportFilename(audit, 'csv'), auditCsv(audit), 'text/csv');

const downloadPdf = async (command: 'generate_audit_pdf' | 'generate_crawl_pdf', args: Record<string, unknown>, filename: string): Promise<void> => {
  const encoded = await invokeTauriCommand<string>(command, args);
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  downloadBlob(filename, new Blob([bytes], { type: 'application/pdf' }));
};

export const downloadAuditPdf = (audit: PageAuditData): Promise<void> => downloadPdf('generate_audit_pdf', { audit }, reportFilename(audit, 'pdf'));

const auditTableFilename = (audit: PageAuditData, table: 'links' | 'images'): string => {
  const host = new URL(audit.final_url).hostname.replace(/[^a-z0-9.-]/gi, '-');
  const date = audit.timestamp.replace(/[^0-9]/g, '').slice(0, 14);
  return `seomi-audit-${host}-${date}-${table}.csv`;
};

export const auditLinksCsv = (audit: PageAuditData): string => {
  const headers = exportHeaders('auditLinks');
  const rows = audit.links.links.map((link) => [
    audit.final_url, audit.timestamp, link.href, link.text, link.is_internal, link.rel || '', link.target || '', link.is_insecure || false,
  ]);
  return csv([headers, ...rows]);
};

export const auditImagesCsv = (audit: PageAuditData): string => {
  const headers = exportHeaders('auditImages');
  const rows = audit.images.map((image) => [
    audit.final_url, audit.timestamp, image.src, image.alt || '', image.has_alt, image.width || '', image.height || '', image.loading || '', image.srcset || '', image.format || '',
  ]);
  return csv([headers, ...rows]);
};

export const downloadAuditLinksCsv = (audit: PageAuditData): void => downloadText(auditTableFilename(audit, 'links'), auditLinksCsv(audit), 'text/csv');
export const downloadAuditImagesCsv = (audit: PageAuditData): void => downloadText(auditTableFilename(audit, 'images'), auditImagesCsv(audit), 'text/csv');

export const backlinkGapCsv = (report: BacklinkGapReport): string => {
  const competitors = report.competitors;
  const backlinkHeaders = exportHeaders('backlink');
  const headers = [backlinkHeaders[0], backlinkHeaders[1], ...competitors.flatMap((domain) => [`${domain} backlinks`, `${domain} rank`]), backlinkHeaders[2]];
  const rows = report.opportunities.map((opportunity) => {
    const byDomain = new Map(opportunity.competitor_backlinks.map((item) => [item.domain, item]));
    return [report.target, opportunity.referring_domain, ...competitors.flatMap((domain) => {
      const item = byDomain.get(domain);
      return [item?.backlinks ?? '', item?.rank ?? ''];
    }), opportunity.max_competitor_spam_score ?? ''];
  });
  return csv([[backlinkHeaders[0], report.target], [exportText('labels.competitors'), competitors.join('; ')], [exportText('labels.includeSubdomains'), report.include_subdomains], [exportText('labels.apiRowsScanned'), report.rows_scanned], [], headers, ...rows]);
};

export const downloadBacklinkGapCsv = (report: BacklinkGapReport): void => {
  const host = report.target.replace(/[^a-z0-9.-]/gi, '-');
  const date = new Date().toISOString().slice(0, 10);
  downloadText(`seomi-backlink-gap-${host}-${date}.csv`, backlinkGapCsv(report), 'text/csv');
};

type CrawlExportMetadata = {
  run_id: string;
  completed_at: string;
  scope_start_url: string;
  environment?: string;
  crawl_configuration: string;
};

const crawlMetadata = (run: CrawlRunRecord): CrawlExportMetadata => ({
  run_id: run.id,
  completed_at: run.completedAt,
  scope_start_url: run.startUrl,
  environment: run.environment,
  crawl_configuration: JSON.stringify(run.config),
});

/**
 * Keep the run envelope visible even when a table has no records.
 * Empty CSV files used to contain only a header, which made it impossible to
 * tell which project scope/configuration produced the export.
 */
const crawlCsv = (
  headers: string[],
  rows: unknown[][],
  metadata: CrawlExportMetadata,
): string => {
  if (rows.length > 0) return csv([headers, ...rows]);
  const envelope = Array<unknown>(headers.length).fill('');
  envelope[0] = metadata.run_id;
  envelope[1] = metadata.completed_at;
  envelope[2] = metadata.scope_start_url;
  if (headers.length > 3) envelope[3] = metadata.crawl_configuration;
  return csv([headers, envelope]);
};

const crawlFilename = (run: CrawlRunRecord, table: string, extension: 'json' | 'csv' | 'pdf'): string => {
  let host = 'crawl';
  try { host = new URL(run.startUrl).hostname.replace(/[^a-z0-9.-]/gi, '-') || host; } catch {}
  const timestamp = run.completedAt.replace(/[^0-9]/g, '').slice(0, 14) || run.id.replace(/[^a-z0-9]/gi, '').slice(0, 14);
  return `seomi-crawl-${host}-${timestamp}-${table}.${extension}`;
};

const reportSections = (template?: CrawlReportTemplate): ReportTemplateSection[] => template?.sections || [];

const filteredCrawlResult = (run: CrawlRunRecord, template?: CrawlReportTemplate): Record<string, unknown> => {
  if (!template) return run.result as unknown as Record<string, unknown>;
  const sections = new Set(reportSections(template));
  const pages = run.result.pages || [];
  const result = run.result as unknown as Record<string, unknown>;
  const filtered: Record<string, unknown> = {
    start_url: run.result.start_url,
    pages_crawled: run.result.pages_crawled,
    health_score: run.result.health_score,
    critical_count: run.result.critical_count,
    warning_count: run.result.warning_count,
    notice_count: run.result.notice_count,
    duration_ms: run.result.duration_ms,
    cancelled: run.result.cancelled,
    timed_out: run.result.timed_out,
    discovery_provenance_truncated: run.result.discovery_provenance_truncated,
    limit_reasons: run.result.limit_reasons || [],
    resource_limit_reached: run.result.resource_limit_reached,
  };
  if (sections.has('configuration')) filtered.configuration = run.config;
  if (sections.has('pages')) filtered.pages = pages;
  if (sections.has('issues')) {
    filtered.issues = pages.flatMap((page) => page.issues.map((issue) => ({ page_url: page.url, ...issue })));
  }
  if (sections.has('links')) {
    filtered.links = pages.flatMap((page) => page.links.map((link) => ({ source_url: page.url, ...link })));
  }
  if (sections.has('images')) {
    filtered.images = pages.flatMap((page) => page.images.map((image) => ({ page_url: page.url, ...image })));
  }
  if (sections.has('resources')) filtered.resources = run.result.resources || [];
  if (sections.has('frames')) {
    filtered.frames = pages.flatMap((page) => (page.frames || []).map((frame) => ({ page_url: page.url, ...frame })));
  }
  if (sections.has('custom-search')) {
    filtered.custom_search = pages.flatMap((page) => (page.custom_search_results || []).map((search) => ({ page_url: page.url, ...search })));
  }
  if (sections.has('semantic')) {
    filtered.semantic = pages.map((page) => ({
      url: page.url,
      final_url: page.final_url,
      title: page.title,
      semantic_terms: page.semantic_terms || [],
      semantic_excerpts: page.semantic_excerpts || [],
      semantic_links: page.semantic_links || [],
      content_hash: page.content_hash,
      content_simhash: page.content_simhash,
    }));
  }
  // Keep crawl-level evidence that is not a selectable table in the report
  // envelope so consumers can identify the exact source snapshot.
  for (const key of ['robots_txt_status', 'robots_user_agent', 'robots_blocked_count', 'sitemap_status', 'sitemap_urls_discovered', 'sitemap_urls']) {
    if (key in result) filtered[key] = result[key];
  }
  return filtered;
};

export const crawlReportPayload = (run: CrawlRunRecord, template?: CrawlReportTemplate): Record<string, unknown> => ({
  export_format: 'seomi-crawl-v1',
  exported_at: new Date().toISOString(),
  report_template: template ? { id: template.id, name: template.name, sections: template.sections } : undefined,
  run: {
    id: run.id,
    completed_at: run.completedAt,
    scope_start_url: run.startUrl,
    environment: run.environment,
    configuration: run.config,
  },
  result: filteredCrawlResult(run, template),
});

export const downloadCrawlPdf = (run: CrawlRunRecord, template?: CrawlReportTemplate): Promise<void> => downloadPdf('generate_crawl_pdf', {
  run: {
    id: run.id,
    completed_at: run.completedAt,
    scope_start_url: run.startUrl,
    environment: run.environment,
    configuration: run.config,
    // The PDF renderer receives the immutable snapshot and applies the
    // section allow-list itself so a report can include issues/links without
    // exposing an unselected pages table in the document.
    result: run.result,
    report_template_sections: template?.sections || null,
    report_template_name: template?.name || null,
  },
}, crawlFilename(run, 'report', 'pdf'));

export const downloadCrawlJson = (run: CrawlRunRecord, template?: CrawlReportTemplate): void => downloadText(crawlFilename(run, 'report', 'json'), JSON.stringify(crawlReportPayload(run, template), null, 2), 'application/json');

export const crawlPagesCsv = (run: CrawlRunRecord): string => {
  const metadata = crawlMetadata(run);
  const headers = exportHeaders('crawlPages');
  const socialResourceStatus = (check: CrawledSocialResourceCheck): string => {
    if (!check.checked_in_run) return exportText('statuses.notChecked');
    if (check.request_error_kind) return exportText('statuses.requestError', { kind: check.request_error_kind });
    return [
      check.http_status == null ? exportText('statuses.noResponse') : exportText('statuses.http', { status: check.http_status }),
      check.content_length == null ? null : exportText('statuses.bytes', { value: check.content_length }),
      check.intrinsic_width && check.intrinsic_height ? `${check.intrinsic_width}x${check.intrinsic_height} (${check.dimensions_source || exportText('statuses.intrinsic')})` : null,
      check.content_type || null,
    ].filter(Boolean).join('; ');
  };
  const socialDeclarations = (page: CrawlRunRecord['result']['pages'][number], prefix: 'og:' | 'twitter:') =>
    (page.social_meta_tags || []).filter((tag) => tag.key.startsWith(prefix))
      .map((tag) => `${tag.key}: ${tag.content === undefined || tag.content === null ? exportText('statuses.missingContent') : tag.content}${tag.resource_check ? ` [${socialResourceStatus(tag.resource_check)}]` : ''}`)
      .join(' | ');
  const faviconDeclarations = (page: CrawlRunRecord['result']['pages'][number]) =>
    (page.favicon_metadata || []).map((favicon) => [
      favicon.href,
      favicon.rel ? i18n.t('crawl.social.faviconRel', { value: favicon.rel }) : null,
      favicon.declared_type ? i18n.t('crawl.social.faviconType', { value: favicon.declared_type }) : null,
      favicon.declared_sizes ? i18n.t('crawl.social.faviconSizes', { value: favicon.declared_sizes }) : null,
      favicon.inferred_format ? i18n.t('crawl.social.faviconFormat', { value: favicon.inferred_format }) : null,
    ].filter(Boolean).join('; ')).join(' | ');
  const canonicalTargets = (page: CrawlRunRecord['result']['pages'][number]) =>
    (page.canonical_targets || []).map((target) => {
      const status = !target.checked_in_run
        ? exportText('statuses.notChecked')
        : target.http_status === 0 || target.http_status == null
          ? exportText('statuses.noResponse')
          : exportText('statuses.http', { status: target.http_status });
      return `${target.relation}: ${target.url} (${status})`;
    }).join(' | ');
  const robotsRules = (run.result.robots_applicable_rules || [])
    .map((rule) => `${rule.directive.toUpperCase()}: ${rule.path}`).join(' | ');
  const robotsBlockedUrls = (run.result.rejected_urls || [])
    .filter((item) => item.reason.startsWith('Blocked by robots.txt'))
    .map((item) => `${item.url} (${item.reason})`).join(' | ');
  const clientRedirects = (page: CrawlRunRecord['result']['pages'][number]) =>
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
  const robotsDecision = (page: CrawlRunRecord['result']['pages'][number]) => {
    const decision = page.robots_decision;
    if (!decision) return '';
    return `${decision.indexability}; ${decision.link_following}; directives=${(decision.directives || []).join(', ') || exportText('statuses.defaults')}; sources=${(decision.sources || []).join(', ') || exportText('statuses.none')}; headers=${decision.response_headers_available ? exportText('statuses.available') : exportText('statuses.unavailable')}`;
  };
  const paginationLinks = (page: CrawlRunRecord['result']['pages'][number]) =>
    (page.pagination_links || []).map((item) => {
      const status = !item.checked_in_run ? exportText('statuses.notChecked') : item.http_status == null ? exportText('statuses.noResponse') : exportText('statuses.http', { status: item.http_status });
      const queryChanges = item.query_parameter_changes.length ? item.query_parameter_changes.join(', ') : exportText('statuses.noQueryChanges');
      const reciprocal = item.reciprocal_in_run === undefined || item.reciprocal_in_run === null
        ? exportText('statuses.reciprocalUnknown')
        : item.reciprocal_in_run ? exportText('statuses.reciprocalYes') : exportText('statuses.reciprocalMissing');
      const reciprocalSuffix = item.reciprocal_in_run === undefined ? '' : `; ${reciprocal}`;
      return `${item.relation}: ${item.target_url} (${status}; ${queryChanges}${reciprocalSuffix})`;
    }).join(' | ');
  const rows = run.result.pages.map((page) => [
    metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration,
    run.result.robots_txt_status, run.result.robots_user_agent || '', robotsRules,
    (run.result.robots_sitemap_directives || []).join(' | '), robotsBlockedUrls,
    page.url, page.final_url,
    (page.discovery_sources || []).map((source) => [source.kind, source.source_url || '', source.anchor_text || ''].filter(Boolean).join(': ')).join(' | '),
    run.result.discovery_provenance_truncated ? exportText('statuses.yes') : exportText('statuses.no'),
    page.depth, page.http_status, page.response_time_ms, page.rendered_lcp_ms ?? '', page.rendered_inp_ms ?? '', page.rendered_cls ?? '', page.request_error_kind || '',
    page.content_type || '', page.content_length ?? '', page.charset || '', page.detected_charset || '',
    (page.html_validation_findings || []).map((finding) => `${finding.severity}: ${finding.code}${finding.line ? ` at ${finding.line}:${finding.column || 1}` : ''}: ${finding.message}${finding.element ? ` <${finding.element}>` : ''}${finding.attribute ? ` [${finding.attribute}]` : ''}${finding.value ? ` = ${finding.value}` : ''}${finding.source_excerpt ? ` source: ${finding.source_excerpt}` : ''}`).join(' | '),
    page.html_validation_truncated ?? '', page.title || '', page.title_length ?? '', page.meta_description || '', page.meta_description_length ?? '',
    page.canonical || '', page.canonical_relation || '', page.canonical_declaration_count ?? '', canonicalTargets(page),
    page.canonical_robots_conflict === undefined ? '' : page.canonical_robots_conflict ? 'yes' : 'no',
    clientRedirects(page),
    page.pagination_declaration_count ?? '', page.pagination_invalid_declaration_count ?? '',
    page.pagination_canonical_alignment || '', paginationLinks(page),
    page.meta_robots || '', page.x_robots_tag || '', robotsDecision(page), page.indexability_verdict?.status || '', (page.indexability_verdict?.reasons || []).join(' | '), page.indexability_status,
    page.word_count, page.sentence_count ?? '', page.average_words_per_sentence ?? '', page.average_characters_per_word ?? '', page.complexity_score ?? '', page.complexity_label || '', page.readability_ease_score ?? '', page.readability_grade ?? '', page.readability_method || '', page.readability_label || '', (page.content_terms || []).map((term) => `${term.term}/${term.count}/${term.density_percent.toFixed(2)}%`).join(' | '), page.focus_phrase ? `${page.focus_phrase.phrase}; body=${page.focus_phrase.body_occurrences}; density=${page.focus_phrase.body_density_percent.toFixed(2)}%; title=${page.focus_phrase.title_occurrences}; meta=${page.focus_phrase.meta_description_occurrences}; h1=${page.focus_phrase.h1_occurrences}` : '', page.content_hash || '', page.h1_count,
    (page.duplicate_headings || []).map((heading) => `${heading.levels.map((level) => `H${level}`).join('/')}: ${heading.text} (${heading.occurrences})`).join(' | '),
    page.internal_link_count, page.external_link_count,
    page.images.length, page.schema_types.join(' | '), page.schema_syntax_errors, page.document_language || '',
    page.hreflangs.map((item) => {
      const status = item.target_checked_in_run ? exportText('statuses.http', { status: item.target_http_status ?? exportText('statuses.unknown') }) : exportText('statuses.notChecked');
      const reciprocal = item.reciprocal_in_run == null ? exportText('statuses.reciprocityUnverified') : item.reciprocal_in_run ? exportText('statuses.reciprocalYes') : exportText('statuses.notReciprocal');
      return `${item.language}: ${item.target_url} (${status}; ${reciprocal}; ${item.target_canonical_alignment || exportText('statuses.canonicalUnverified')})`;
    }).join(' | '), page.amp_url || '', page.amp_target_http_status ?? '',
    page.amp_target_checked_in_run === undefined ? '' : page.amp_target_checked_in_run ? 'yes' : 'no',
    page.amp_target_canonical_alignment === 'canonical-to-source'
      ? exportText('statuses.yes')
      : page.amp_target_canonical_alignment === 'missing-canonical'
        ? exportText('statuses.none')
        : page.amp_target_canonical_alignment
          ? exportText('statuses.no')
          : exportText('statuses.canonicalUnverified'),
    (page.favicons || []).map((favicon) => {
      const check = page.favicon_resource_checks?.find((candidate) => candidate.url === favicon);
      return check ? `${favicon} [${socialResourceStatus(check)}]` : favicon;
    }).join(' | '), faviconDeclarations(page), socialDeclarations(page, 'og:'), socialDeclarations(page, 'twitter:'),
    page.body_truncated, page.redirect_chain.map((hop) => `${hop.http_status}: ${hop.from_url} -> ${hop.to_url} (${hop.response_time_ms == null ? exportText('statuses.timingUnavailable') : `${hop.response_time_ms} ms`})`).join(' | '),
    page.redirect_stop_reason || '',
    page.issues_count, page.issues.map((issue) => `${issue.severity}: ${issue.message}`).join(' | '),
  ]);
  return crawlCsv(headers, rows, metadata);
};

export const crawlLinksCsv = (run: CrawlRunRecord): string => {
  const metadata = crawlMetadata(run);
  const headers = exportHeaders('crawlLinks');
  const rows = run.result.pages.flatMap((page) => page.links.map((link) => [
    metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration,
    page.url, page.final_url, link.target_url, link.target_http_status ?? '', link.target_response_time_ms ?? '',
    link.target_redirect_url || '', link.target_request_error_kind || '', link.target_checked_at || '',
    link.anchor_text, link.rel || '', link.is_internal, link.source_excerpt || '',
  ]));
  return crawlCsv(headers, rows, metadata);
};

export const crawlImagesCsv = (run: CrawlRunRecord): string => {
  const metadata = crawlMetadata(run);
  const headers = exportHeaders('crawlImages');
  const rows = run.result.pages.flatMap((page) => page.images.map((image) => [
    metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration,
    page.url, page.final_url, image.src, image.checked_in_run ?? '', image.http_status ?? '', image.request_error_kind || '', image.content_length ?? '', image.alt || '', image.srcset || '',
    (image.srcset_resource_checks || []).map((candidate) => `${candidate.url}: ${candidate.checked_in_run ? candidate.http_status ?? candidate.request_error_kind ?? exportText('statuses.checked') : exportText('statuses.notChecked')}${candidate.content_length == null ? '' : ` (${candidate.content_length} B)`}`).join(' | '),
    image.srcset_resource_checks_truncated ?? '', image.format || '', image.width ?? '', image.height ?? '', image.dimensions_source || '', image.lazy_loaded,
  ]));
  return crawlCsv(headers, rows, metadata);
};

export const crawlCustomSearchCsv = (run: CrawlRunRecord): string => {
  const metadata = crawlMetadata(run);
  const searches = run.config.customSearches || [];
  const headers = exportHeaders('crawlCustomSearch');
  const rows = run.result.pages.flatMap((page) => searches.flatMap((search) => {
    const result = page.custom_search_results?.find((item) => item.id === search.id);
    if (!result) return [[metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration, page.url, page.final_url, search.name, search.selectorType, search.query, search.resultType, search.attribute || '', '', '', exportText('statuses.noSavedResult')]];
    if (result.error) return [[metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration, page.url, page.final_url, search.name, search.selectorType, search.query, search.resultType, search.attribute || '', '', '', result.error]];
    if (result.values.length === 0) return [[metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration, page.url, page.final_url, search.name, search.selectorType, search.query, search.resultType, search.attribute || '', '', '', exportText('statuses.noMatch')]];
    return result.values.map((value, index) => [metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration, page.url, page.final_url, search.name, search.selectorType, search.query, search.resultType, search.attribute || '', index + 1, value, result.truncated ? exportText('statuses.limitedResult') : 'OK']);
  }));
  return crawlCsv(headers, rows, metadata);
};

export const crawlResourcesCsv = (run: CrawlRunRecord): string => {
  const metadata = crawlMetadata(run);
  const headers = exportHeaders('crawlResources');
  const rows = buildCrawlResourceInventory(run.result).map(({ resource, sourceUrls, knownSourceUrls, status }) => [
    metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration,
    resource.url, resource.resource_type, sourceUrls.join(' | '), knownSourceUrls.join(' | '), status, resource.http_status ?? '', resource.content_type || '', resource.content_length ?? '', resource.intrinsic_width ?? '', resource.intrinsic_height ?? '', resource.dimensions_source || '', resource.response_time_ms ?? '', resource.request_error_kind || '',
  ]);
  return crawlCsv(headers, rows, metadata);
};

export const crawlFramesCsv = (run: CrawlRunRecord): string => {
  const metadata = crawlMetadata(run);
  const headers = exportHeaders('crawlFrames');
  const rows = run.result.pages.flatMap((page) => (page.frames || []).map((frame) => [
    metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration,
    page.url, frame.src || '', frame.resolved_url || '', frame.title || '', frame.name || '', frame.loading || '', frame.sandbox ?? '',
    frame.checked_in_run ?? false, frame.http_status ?? '', frame.request_error_kind || '', page.frames_truncated ?? false,
  ]));
  return crawlCsv(headers, rows, metadata);
};

export const crawlIssuesCsv = (run: CrawlRunRecord): string => {
  const metadata = crawlMetadata(run);
  const headers = exportHeaders('crawlIssues');
  const rows = run.result.pages.flatMap((page) => page.issues.map((issue) => [
    metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration,
    page.url, page.final_url, issue.severity, issue.message,
  ]));
  return crawlCsv(headers, rows, metadata);
};

export const downloadCrawlPagesCsv = (run: CrawlRunRecord): void => downloadText(crawlFilename(run, 'urls', 'csv'), crawlPagesCsv(run), 'text/csv');
export const downloadCrawlLinksCsv = (run: CrawlRunRecord): void => downloadText(crawlFilename(run, 'links', 'csv'), crawlLinksCsv(run), 'text/csv');
export const downloadCrawlImagesCsv = (run: CrawlRunRecord): void => downloadText(crawlFilename(run, 'images', 'csv'), crawlImagesCsv(run), 'text/csv');
export const downloadCrawlCustomSearchCsv = (run: CrawlRunRecord): void => downloadText(crawlFilename(run, 'custom-search', 'csv'), crawlCustomSearchCsv(run), 'text/csv');
export const downloadCrawlResourcesCsv = (run: CrawlRunRecord): void => downloadText(crawlFilename(run, 'resources', 'csv'), crawlResourcesCsv(run), 'text/csv');
export const downloadCrawlFramesCsv = (run: CrawlRunRecord): void => downloadText(crawlFilename(run, 'frames', 'csv'), crawlFramesCsv(run), 'text/csv');
export const downloadCrawlIssuesCsv = (run: CrawlRunRecord): void => downloadText(crawlFilename(run, 'issues', 'csv'), crawlIssuesCsv(run), 'text/csv');
