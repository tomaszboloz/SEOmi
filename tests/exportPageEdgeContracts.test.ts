import { expect, it } from 'vitest';
import { crawlPagesCsv } from '@/services/export';
import { crawlRun } from './fixtures/export';
import i18n from '@/i18n';
it('exports zero measurements, sparse findings and explicit negative verification without inventing missing evidence', () => {
  const page = { ...crawlRun.result.pages[0], title: '', title_length: 0, meta_description: '', meta_description_length: 0,
    content_type: 'text/html', content_length: 0, charset: 'UTF-8', detected_charset: 'UTF-8', request_error_kind: 'timeout',
    rendered_lcp_ms: 0, rendered_inp_ms: 0, rendered_cls: 0,
    html_validation_findings: [{ code: 'observed', severity: 'Info', message: 'Sparse finding', line: 9 }, { code: 'observed', severity: 'Info', message: 'No position' }],
    html_validation_truncated: false, canonical: '', canonical_relation: '', canonical_declaration_count: 0, canonical_robots_conflict: false,
    pagination_declaration_count: 0, pagination_invalid_declaration_count: 0, pagination_canonical_alignment: 'missing-canonical',
    meta_robots: 'noindex', x_robots_tag: 'nofollow', indexability_verdict: { status: 'blocked', reasons: ['Observed blocking directive'] },
    indexability_status: 'Blocked from this response', document_language: 'pl',
    amp_url: 'https://site.test/amp', amp_target_http_status: 0, amp_target_checked_in_run: false, amp_target_canonical_alignment: 'missing-canonical',
    favicons: ['/unmatched.ico'], favicon_resource_checks: [],
    redirect_chain: [{ http_status: 301, from_url: 'https://site.test/from', to_url: 'https://site.test/to', response_time_ms: 0 }],
    discovery_sources: [{ kind: 'link', source_url: '', anchor_text: '' }],
  };
  const run = { ...crawlRun, result: { ...crawlRun.result, pages: [page], rejected_urls: [{ url: '/not-robots', reason: 'Outside scope' }] } } as never;
  const output = crawlPagesCsv(run);
  expect(output).toContain('at 9:1'); expect(output).toContain('No position');
  expect(output).toContain('"0","0","0","timeout"'); expect(output).toContain('Observed blocking directive');
  expect(output).toContain('/unmatched.ico'); expect(output).toContain('(0 ms)');
  expect(output).not.toContain('/not-robots');
});
it.each(['canonical-to-source', 'missing-canonical', undefined])('keeps AMP alignment %j distinct and does not manufacture target checks', alignment => {
  const run = { ...crawlRun, result: { ...crawlRun.result, pages: [{ ...crawlRun.result.pages[0], amp_target_canonical_alignment: alignment }] } } as never;
  const output = crawlPagesCsv(run);
  const expected = alignment === 'canonical-to-source' ? i18n.t('exportUi.statuses.yes') : alignment === 'missing-canonical' ? i18n.t('exportUi.statuses.none') : i18n.t('exportUi.statuses.canonicalUnverified');
  expect(output).toContain(expected);
});
it('keeps absent titles and meta descriptions blank instead of exporting undefined', () => {
  const run = { ...crawlRun, result: { ...crawlRun.result, pages: [{ ...crawlRun.result.pages[0], title: undefined, meta_description: undefined }] } } as never;
  expect(crawlPagesCsv(run)).not.toContain('undefined');
});

it('reports nonreciprocal hreflang and unavailable redirect timing explicitly', () => {
  const run = { ...crawlRun, result: { ...crawlRun.result, pages: [{ ...crawlRun.result.pages[0],
    hreflangs: [{ language: 'en', target_url: 'https://site.test/en', target_checked_in_run: true, target_http_status: 200, reciprocal_in_run: false }],
    redirect_chain: [{ http_status: 302, from_url: '/from', to_url: '/to' }],
  }] } } as never;
  const output = crawlPagesCsv(run);
  expect(output).toContain(i18n.t('exportUi.statuses.notReciprocal'));
  expect(output).toContain(`302: /from -> /to (${i18n.t('exportUi.statuses.timingUnavailable')})`);
});
