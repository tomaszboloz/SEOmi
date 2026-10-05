import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CrawlMediaImageRow } from '@/components/Domain/crawlResults/mediaTab/CrawlMediaImageRow';
import { formatNumber } from '@/components/Domain/crawlResults/helpers/crawlResultsFormatters';
import type { CrawledImage } from '@/types';
import { createCrawlPageFixture } from './fixtures/crawl';
import i18n from '@/i18n';

const page = createCrawlPageFixture({ url: 'https://example.test/page' });
const image = (patch: Partial<CrawledImage> = {}): CrawledImage =>
  ({ src: 'https://example.test/a.png', lazy_loaded: false, ...patch });
const renderRow = (patch: Partial<CrawledImage> = {}) => {
  render(<table><tbody><CrawlMediaImageRow item={{ page, image: image(patch), key: 'k' }} t={i18n.t.bind(i18n)} /></tbody></table>);
  return screen.getAllByRole('cell');
};
const t = (k: string, o?: object): string => String(i18n.t(k, o as never));

describe('CrawlMediaImageRow', () => {
  beforeEach(() => i18n.changeLanguage('en'));

  it('shows page, source and unchecked defaults for a bare image', () => {
    const cells = renderRow();
    expect(cells[0].textContent).toBe('https://example.test/page');
    expect(cells[1].textContent).toBe('https://example.test/a.png');
    expect(cells[2].textContent).toBe(t('crawl.ui.notChecked'));
    expect(cells[2].className).toContain('text-slate-500');
    expect(cells[3].textContent).toBe('—');
    expect(cells[4].textContent).toBe(t('crawl.ui.missingAlt'));
    expect(cells[4].className).toContain('text-rose-300');
    expect(cells[5].textContent).toBe('—');
    expect(cells[6].textContent).toBe('— × —');
    expect(cells[7].textContent).toBe(t('crawl.ui.standard'));
  });

  it('reports successful checks, size, alt, format and dimensions', () => {
    const cells = renderRow({
      checked_in_run: true, http_status: 200, content_length: 2048, alt: 'Logo', format: 'png',
      width: 64, height: 32, lazy_loaded: true, dimensions_source: 'attributes',
    });
    expect(cells[2].textContent).toBe(t('crawl.ui.httpStatus', { status: 200 }));
    expect(cells[2].className).toContain('text-emerald-300');
    expect(cells[3].textContent).toBe(`${formatNumber(2048)} B`);
    expect(cells[4].textContent).toBe('Logo');
    expect(cells[5].textContent).toBe('png');
    expect(cells[6].textContent).toContain('64 × 32');
    expect(cells[6].textContent).toContain(t('crawl.ui.dimensionSources.attributes'));
    expect(cells[7].textContent).toBe(t('crawl.ui.lazy'));
  });

  it.each([
    ['HTTP error status', { checked_in_run: true, http_status: 404 }, t('crawl.ui.httpStatus', { status: 404 }), 'text-rose-300'],
    ['request error kind', { checked_in_run: true, request_error_kind: 'timeout' }, 'timeout', 'text-rose-300'],
    ['no status at all', { checked_in_run: true }, t('crawl.ui.noStatus'), 'text-emerald-300'],
    ['error on unchecked image', { http_status: 500 }, t('crawl.ui.notChecked'), 'text-rose-300'],
  ])('renders %s', (_n, patch, text, cls) => {
    const cell = renderRow(patch)[2];
    expect(cell.textContent).toBe(text);
    expect(cell.className).toContain(cls);
  });

  it('shows zero bytes and an explicit empty alt', () => {
    const cells = renderRow({ content_length: 0, alt: '' });
    expect(cells[3].textContent).toBe(`${formatNumber(0)} B`);
    expect(cells[4].textContent).toBe(t('crawl.ui.emptyAlt'));
    expect(cells[4].className).toContain('text-slate-300');
  });

  it.each([
    ['intrinsic-data-uri', 'dataUri'], ['intrinsic-http', 'http'], ['mixed', 'mixed'], ['other', 'attributes'],
  ])('maps dimension source %s', (source, key) => {
    const cell = renderRow({ width: 1, height: 2, dimensions_source: source })[6];
    expect(cell.textContent).toContain(t(`crawl.ui.dimensionSources.${key}`));
  });

  it('notes a srcset without checked variants', () => {
    const cells = renderRow({ srcset: 'a.png 1x' });
    const note = within(cells[1]).getByText(t('crawl.ui.srcsetNoVariants'));
    expect(note.getAttribute('title')).toBe('a.png 1x');
  });

  it('lists srcset variants with status, size and truncation notice', () => {
    const cells = renderRow({
      srcset: 'x', srcset_resource_checks_truncated: true,
      srcset_resource_checks: [
        { url: 'u1', checked_in_run: true, http_status: 200, content_length: 1500 },
        { url: 'u2', checked_in_run: true, request_error_kind: 'dns', content_length: null },
        { url: 'u3', checked_in_run: true },
        { url: 'u4', checked_in_run: true, http_status: 404 },
        { url: 'u5', checked_in_run: false },
      ],
    });
    const items = within(cells[1]).getAllByRole('listitem');
    expect(within(cells[1]).getByText(t('uiUnits.srcsetVariants', { count: 5 }))).toBeTruthy();
    expect(items[0].textContent).toContain(`${t('crawl.ui.httpStatus', { status: 200 })} · ${formatNumber(1500)} B`);
    expect(items[1].textContent).toContain('dns');
    expect(items[1].textContent).not.toContain(' B');
    expect(items[2].textContent).toContain(t('crawl.ui.checked'));
    expect(items[3].querySelector('span')!.className).toContain('text-rose-300');
    expect(items[4].textContent).toContain(t('crawl.ui.notChecked'));
    expect(items[4].querySelector('span')!.className).toContain('text-slate-500');
    expect(items[0].querySelector('span')!.className).toContain('text-emerald-300');
    expect(within(cells[1]).getByText(t('crawl.ui.srcsetTruncated'))).toBeTruthy();
  });

  it('omits the truncation notice when variants are complete', () => {
    const cells = renderRow({ srcset_resource_checks: [{ url: 'u', checked_in_run: false }] });
    expect(within(cells[1]).queryByText(t('crawl.ui.srcsetTruncated'))).toBeNull();
  });
});
