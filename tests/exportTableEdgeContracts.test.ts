import { expect, it } from 'vitest';
import { auditCsv, auditLinksCsv, auditImagesCsv, backlinkGapCsv, crawlCustomSearchCsv, crawlImagesCsv, crawlFramesCsv, crawlResourcesCsv } from '@/services/export';
import { audit, crawlRun } from './fixtures/export';
import i18n from '@/i18n';
it('keeps missing audit metadata and issue recommendations blank', () => {
  const data = { ...audit, meta_tags: {}, issues: [{ severity: 'Info', category: 'Technical', message: 'Observed' }] } as never;
  expect(auditCsv(data)).toContain('"Info","Technical","Observed",""');
  expect(auditLinksCsv({ ...audit, links: { ...audit.links, links: [{ href: '/target', text: 'Observed', is_internal: true, rel: 'follow', target: '_blank', is_insecure: true }] } } as never)).toContain('"follow","_blank","true"');
  expect(auditImagesCsv({ ...audit, images: [{ src: '/image', alt: 'Observed', has_alt: true, width: 640, height: 480, loading: 'lazy', srcset: '/image-2 2x', format: 'PNG' }] } as never)).toContain('"640","480","lazy","/image-2 2x","PNG"');
});
it('preserves zero backlink metrics while leaving missing competitor evidence blank', () => {
  const result = backlinkGapCsv({ target: 'site.test', competitors: ['one.test', 'missing.test'], include_subdomains: false, rows_scanned: 1, total_rows: 1,
    opportunities: [{ referring_domain: 'observed.test', competitor_backlinks: [{ domain: 'one.test', backlinks: 0, rank: null }], max_competitor_spam_score: null }],
  } as never);
  expect(result).toContain('"observed.test","0","","","",""');
});
it.each(['missing', 'error', 'empty', 'limited'])('exports custom-search %s evidence without guessing a match', mode => {
  const search = { id: 'observed', name: 'Observed', selectorType: 'css', query: 'h1', resultType: 'text' };
  const matches = mode === 'missing' ? undefined : [{ id: 'observed', values: mode === 'empty' || mode === 'error' ? [] : ['Observed'], error: mode === 'error' ? 'selector rejected' : null, truncated: mode === 'limited' }];
  const run = { ...crawlRun, config: { ...crawlRun.config, customSearches: [search] }, result: { ...crawlRun.result, pages: [{ ...crawlRun.result.pages[0], custom_search_results: matches }] } } as never;
  const result = crawlCustomSearchCsv(run);
  const expected = mode === 'missing' ? i18n.t('exportUi.statuses.noSavedResult') : mode === 'error' ? 'selector rejected' : mode === 'empty' ? i18n.t('exportUi.statuses.noMatch') : i18n.t('exportUi.statuses.limitedResult');
  expect(result).toContain(expected);
});
it('preserves unknown and failed srcset checks, including observed zero bytes', () => {
  const run = { ...crawlRun, result: { ...crawlRun.result, pages: [{ ...crawlRun.result.pages[0], images: [{ src: '/image', lazy_loaded: false,
    srcset_resource_checks: [
      { url: '/unchecked', checked_in_run: false },
      { url: '/failed', checked_in_run: true, request_error_kind: 'timeout', content_length: 0 },
      { url: '/unknown', checked_in_run: true },
    ],
  }] }] } } as never;
  const result = crawlImagesCsv(run);
  expect(result).toContain(`/unchecked: ${i18n.t('exportUi.statuses.notChecked')}`);
  expect(result).toContain('/failed: timeout (0 B)'); expect(result).toContain(`/unknown: ${i18n.t('exportUi.statuses.checked')}`);
});
it('exports absent frame metadata as missing evidence and observed zero resource metrics', () => {
  const run = { ...crawlRun, result: { ...crawlRun.result, pages: [{ ...crawlRun.result.pages[0], frames: [{}] }], resources: [{
    url: '/resource', resource_type: 'other', source_urls: [], http_status: 0, content_length: 0, intrinsic_width: 0, intrinsic_height: 0, response_time_ms: 0,
  }] } } as never;
  expect(crawlFramesCsv(run)).toMatch(/,"false","","","false"$/);
  expect(crawlResourcesCsv(run)).toContain('"0"');
});

it('leaves unobserved resource attributes blank and handles pages without frame snapshots', () => {
  const run = { ...crawlRun, result: { ...crawlRun.result, pages: [{ ...crawlRun.result.pages[0], frames: undefined }], resources: [{
    url: 'https://site.test/unknown', resource_type: 'stylesheet', checked_in_run: true, source_urls: [], http_status: 200,
  }] } } as never;
  const frameRows = crawlFramesCsv(run).split('\r\n');
  expect(frameRows).toHaveLength(2);
  expect(frameRows[1]).toContain(crawlRun.id);
  expect(frameRows[1]).not.toContain('https://site.test/unknown');
  expect(crawlResourcesCsv(run)).toContain('"200","","","","","","",""');
  const linkRun = { ...audit, links: { ...audit.links, links: [{ href: '/missing-rel', text: 'Missing rel', is_internal: true }] } } as never;
  expect(auditLinksCsv(linkRun)).toContain('"Missing rel","true","","","false"');
});

it('keeps missing resource response status blank rather than inventing a response', () => {
  const run = { ...crawlRun, result: { ...crawlRun.result, resources: [{
    url: 'https://site.test/no-response', resource_type: 'stylesheet', source_urls: [], request_error_kind: 'timeout',
  }] } } as never;
  const output = crawlResourcesCsv(run);
  expect(output).toContain('"unknown","","","","","","","","timeout"');
});
