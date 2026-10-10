import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import type { CrawledSocialResourceCheck, CrawledPageSummary } from '@/types';
import { CrawlSocialFaviconCell, formatResourceStatus } from '@/components/Domain/crawlResults/socialTab/CrawlSocialFaviconCell';
import { createCrawlPageFixture } from './fixtures/crawl';

const check: CrawledSocialResourceCheck = { url: 'https://example.test/icon', checked_in_run: true };
const show = (patch: Partial<CrawledPageSummary>) => render(<table><tbody><tr><CrawlSocialFaviconCell page={createCrawlPageFixture(patch)} t={i18n.t} /></tr></tbody></table>);
afterEach(cleanup);

it('distinguishes unrequested resources from transport failures', () => {
  expect(formatResourceStatus({ ...check, checked_in_run: false, http_status: 200 }, i18n.t)).toBe(i18n.t('crawl.social.notChecked'));
  expect(formatResourceStatus({ ...check, request_error_kind: 'timeout', http_status: 200 }, i18n.t)).toBe(i18n.t('crawl.social.requestError', { kind: 'timeout' }));
});

it.each([undefined, null, 0])('does not render a nonexistent HTTP response %s', (http_status) => {
  expect(formatResourceStatus({ ...check, http_status }, i18n.t)).toBe(i18n.t('crawl.social.noHttpStatus'));
});

it('keeps zero measured size and complete dimensions with their provenance', () => {
  expect(formatResourceStatus({ ...check, http_status: 200, content_length: 0, intrinsic_width: 16, intrinsic_height: 16, dimensions_source: 'intrinsic-http', content_type: 'image/png' }, i18n.t))
    .toBe(`${i18n.t('crawl.ui.httpStatus', { status: 200 })} · 0 B · 16 × 16 · intrinsic-http · image/png`);
  expect(formatResourceStatus({ ...check, intrinsic_width: 16, intrinsic_height: 16 }, i18n.t)).toContain(`16 × 16 · ${i18n.t('crawl.social.intrinsic')}`);
  expect(formatResourceStatus({ ...check, intrinsic_width: 16, intrinsic_height: 0 }, i18n.t)).not.toContain('×');
  expect(formatResourceStatus({ ...check, intrinsic_width: 0, intrinsic_height: 16 }, i18n.t)).not.toContain('×');
});

it('shows no declaration when both favicon lists are missing or empty', () => {
  const view = show({});
  expect(screen.getByText(i18n.t('crawl.social.noDeclaration'))).toBeTruthy();
  view.unmount();
  show({ favicons: [], favicon_metadata: [] });
  expect(screen.getByText(i18n.t('crawl.social.noDeclaration'))).toBeTruthy();
});

it('renders legacy URLs without inventing metadata or checks', () => {
  show({ favicons: [check.url], favicon_metadata: [] });
  expect(screen.getByText(check.url)).toBeTruthy();
  expect(screen.getByText(i18n.t('crawl.social.noResourceStatus'))).toBeTruthy();
});

it('uses richer metadata instead of duplicate legacy URLs and finds its resource', () => {
  show({ favicons: ['https://old.test/icon'], favicon_metadata: [{ href: check.url, rel: 'icon', declared_type: 'image/png', declared_sizes: '16x16', inferred_format: 'png' }], favicon_resource_checks: [{ ...check, http_status: 200 }] });
  expect(screen.queryByText('https://old.test/icon')).toBeNull();
  expect(screen.getByText(i18n.t('crawl.ui.httpStatus', { status: 200 }))).toBeTruthy();
  for (const [key, value] of [['faviconRel', 'icon'], ['faviconType', 'image/png'], ['faviconSizes', '16x16'], ['faviconFormat', 'png']]) {
    expect(screen.getByText((text) => text.includes(i18n.t(`crawl.social.${key}`, { value })))).toBeTruthy();
  }
});

it.each(['rel', 'declared_type', 'declared_sizes', 'inferred_format'] as const)('renders an isolated %s declaration without other metadata', (key) => {
  show({ favicon_metadata: [{ href: check.url, rel: '', [key]: 'value' }], favicon_resource_checks: [{ ...check, url: 'https://unrelated.test' }] });
  expect(screen.getByText((text) => text.includes('value'))).toBeTruthy();
  expect(screen.getByText(i18n.t('crawl.social.noResourceStatus'))).toBeTruthy();
});
