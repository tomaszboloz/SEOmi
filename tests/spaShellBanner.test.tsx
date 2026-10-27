import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import i18n from '@/i18n';
import en from '@/i18n/locales/en.json';
import { SpaShellBanner, summarizeJsShells } from '@/components/Domain/crawlResults/SpaShellBanner';
import { createCrawlPageFixture } from './fixtures/crawl';

const payload = (word_count: number) => ({
  provenance: 'payload' as const, source: '__NEXT_DATA__', text: 'Payload words only', word_count, links: [], truncated: false,
});
const pages = [
  createCrawlPageFixture({ url: 'https://example.test/a', is_js_shell_suspected: true, js_shell_reason: 'next_data', spa_payload: payload(42) }),
  createCrawlPageFixture({ url: 'https://example.test/b', is_js_shell_suspected: true, js_shell_reason: 'next_data' }),
  createCrawlPageFixture({ url: 'https://example.test/c', is_js_shell_suspected: true, js_shell_reason: 'bundle_empty_root' }),
  createCrawlPageFixture({ url: 'https://example.test/d', is_js_shell_suspected: true }),
  createCrawlPageFixture({ url: 'https://example.test/e', is_js_shell_suspected: false }),
  createCrawlPageFixture({ url: 'https://example.test/f' }),
];

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('SpaShellBanner', () => {
  it('renders nothing when no page is a suspected JS shell', () => {
    const { container } = render(<SpaShellBanner pages={pages.slice(4)} />);
    expect(container.firstChild).toBeNull();
    expect(render(<SpaShellBanner pages={[]} />).container.firstChild).toBeNull();
    expect(render(<SpaShellBanner pages={undefined} />).container.firstChild).toBeNull();
  });

  it('counts shells per recorded reason and only payload-backed shells as read', () => {
    render(<SpaShellBanner pages={pages} />);
    const banner = screen.getByTestId('spa-shell-banner');
    expect(banner.textContent).toContain(en.crawl.spaShell.summary.replace('{{count}}', '4'));
    const reasons = Array.from(banner.querySelectorAll('li[data-reason]')).map((item) => [item.getAttribute('data-reason'), item.textContent]);
    expect(reasons).toEqual([
      ['next_data', `${en.crawl.spaShell.reasons.next_data}: 2`],
      ['bundle_empty_root', `${en.crawl.spaShell.reasons.bundle_empty_root}: 1`],
      ['unknown', `${en.crawl.spaShell.reasons.unknown}: 1`],
    ]);
    expect(banner.textContent).toContain('for 1 of 4 of them');
    expect(within(banner).getByRole('button', { name: en.help.overview.jsShell.title })).toBeTruthy();
  });

  it('lists affected URLs and labels payload word counts as not rendered content', () => {
    render(<SpaShellBanner pages={pages} />);
    fireEvent.click(screen.getByText(en.crawl.spaShell.showUrls));
    const items = screen.getAllByText(/https:\/\/example\.test\//).map((node) => node.textContent);
    expect(items).toHaveLength(4);
    expect(items[0]).toContain('JS payload words: 42 (not rendered content)');
    expect(items[1]).not.toContain('payload words');
    expect(screen.queryByText(/Payload words only/)).toBeNull();
  });

  it('says so when no shell had a readable payload', () => {
    render(<SpaShellBanner pages={pages.slice(1, 3)} />);
    expect(screen.getByText(en.crawl.spaShell.noPayload)).toBeTruthy();
    expect(summarizeJsShells(pages.slice(1, 3))).toMatchObject({ withPayload: 0, reasons: [{ reason: 'next_data', count: 1 }, { reason: 'bundle_empty_root', count: 1 }] });
  });
});
