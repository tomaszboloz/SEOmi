import type { CrawlRunRecord } from '@/types';
import { exportHeaders, exportText } from './csv';
import { crawlMetadata, crawlCsv } from './crawlMetadata';
import { observedHttpStatus, socialResourceStatus, socialDeclarations, faviconDeclarations, canonicalTargets, clientRedirects, robotsDecision, paginationLinks } from './crawlPageEvidence';

export const crawlPagesCsv = (run: CrawlRunRecord): string => {
  const metadata = crawlMetadata(run);
  const headers = exportHeaders('crawlPages');
  const robotsRules = (run.result.robots_applicable_rules || [])
    .map((rule) => `${rule.directive.toUpperCase()}: ${rule.path}`).join(' | ');
  const robotsBlockedUrls = (run.result.rejected_urls || [])
    .filter((item) => item.reason.startsWith('Blocked by robots.txt'))
    .map((item) => `${item.url} (${item.reason})`).join(' | ');
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
      const status = item.target_checked_in_run ? observedHttpStatus(item.target_http_status) : exportText('statuses.notChecked');
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
