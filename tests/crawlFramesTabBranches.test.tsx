import { render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import { CrawlFramesTab } from '@/components/Domain/crawlResults/CrawlFramesTab';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';

const t = (k: string, o?: object) => i18n.t(k, o);
const show = (pages: object[]) => render(<CrawlFramesTab session={{ result: createCrawlResultFixture({ pages: pages as never }), t: i18n.t.bind(i18n) } as never} />);
const row = (index: number) => screen.getAllByRole('row')[index + 1];
beforeEach(async () => { await i18n.changeLanguage('en'); });

it('shows the empty state when no page declares frames', () => {
  show([createCrawlPageFixture(), createCrawlPageFixture({ frames: undefined })]);
  expect(screen.getByText(t('crawl.ui.noFrames'))).toBeTruthy();
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.getByText(t('crawl.ui.framesDescription'))).toBeTruthy();
});

it('derives a status label for every frame state and colours the status cell', () => {
  show([createCrawlPageFixture({ frames: [
    { src: '/ok', resolved_url: 'https://e.test/ok', checked_in_run: true, http_status: 200, title: 'Ok', name: 'n', loading: 'lazy', sandbox: 'allow-scripts' },
    { src: '/bad', resolved_url: 'https://e.test/bad', checked_in_run: true, http_status: 404 },
    { src: '/err', resolved_url: 'https://e.test/err', checked_in_run: true, request_error_kind: 'timeout' },
    { src: '/none', resolved_url: 'https://e.test/none', checked_in_run: true },
    { src: '/skipped', resolved_url: 'https://e.test/skipped', checked_in_run: false },
    { src: '', checked_in_run: false },
  ] as never })]);
  const status = (i: number) => within(row(i)).getAllByRole('cell')[3];
  expect(status(0).textContent).toBe(t('crawl.ui.httpStatus', { status: 200 }));
  expect(status(0).className).toContain('emerald');
  expect(status(1).textContent).toBe(t('crawl.ui.httpStatus', { status: 404 }));
  expect(status(1).className).toContain('rose');
  expect(status(2).textContent).toBe(t('crawl.ui.requestError', { kind: 'timeout' }));
  expect(status(2).className).toContain('rose');
  expect(status(3).textContent).toBe(t('crawl.ui.checkedNoStatus'));
  expect(status(4).textContent).toBe(t('crawl.ui.notChecked'));
  expect(status(4).className).toContain('slate-500');
  expect(status(5).textContent).toBe(t('crawl.ui.noHttpTarget'));
});

it('renders attributes with dash fallbacks and the blank-src label', () => {
  show([createCrawlPageFixture({ url: 'https://e.test/page', frames: [{ src: '', checked_in_run: false }, { src: '/x', resolved_url: 'https://e.test/x', title: 'T', name: 'N', loading: 'lazy', sandbox: '', checked_in_run: false }] as never })]);
  const first = within(row(0)).getAllByRole('cell');
  expect(first[0].textContent).toBe('https://e.test/page');
  expect(first[1].textContent).toBe(t('crawl.ui.noSrcBlank'));
  expect([2, 4, 5, 6, 7].map((i) => first[i].textContent)).toEqual(['—', '—', '—', '—', '—']);
  const second = within(row(1)).getAllByRole('cell');
  expect([1, 2, 4, 5, 6, 7].map((i) => second[i].textContent)).toEqual(['/x', 'https://e.test/x', 'T', 'N', 'lazy', '']);
});

it('warns only when some page truncated its frame list', () => {
  const frames = [{ src: '/a', checked_in_run: false }] as never;
  const { unmount } = show([createCrawlPageFixture({ frames })]);
  expect(screen.queryByText(t('crawl.ui.framesTruncated'))).toBeNull();
  unmount();
  show([createCrawlPageFixture({ frames }), createCrawlPageFixture({ frames, frames_truncated: true } as never)]);
  expect(screen.getByText(t('crawl.ui.framesTruncated'))).toBeTruthy();
});
