import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AioPagesTable } from '@/components/Domain/crawlResults/aio/AioPagesTable';
import { CrawlAioTab } from '@/components/Domain/crawlResults/aio/CrawlAioTab';
import i18n from '@/i18n';
import { REPORT_TEMPLATE_SECTIONS } from '@/services/reportTemplates';
import type { AioPageReport } from '@/services/aioReadiness';
import { downloadCrawlPdf } from '@/services/export/crawlReport';
import { invokeTauriCommand } from '@/services/tauri';
import { tabs, tabGroupForTab } from '@/components/Domain/crawlResults/helpers/crawlResultsTabsConfig';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import { aioPage, GOOD, GOOD_PAGE, WEAK_PAGE } from './aioFixtures';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));

const row = (url: string, score: number, extra: Partial<AioPageReport> = {}): AioPageReport => ({
  url, score, selfContainment: 50, spoDensity: 50, extractability: 50, language: 'en', coverage: 'full', chunkCount: 2, danglingCount: 0, tripleCount: 1, wordCount: 100, weakChunks: [], ...extra,
});

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('AioPagesTable', () => {
  it('shows an empty message, orders skipped pages last and colours by score', () => {
    const { rerender } = render(<AioPagesTable pages={[]} />);
    expect(screen.getByText('No pages to show.')).toBeTruthy();
    rerender(<AioPagesTable pages={[row('https://a.test/hi', 90), row('https://a.test/mid', 65), row('https://a.test/skip', 0, { skipped: 'non-html' }), row('https://a.test/lo', 20)]} />);
    const urls = screen.getAllByRole('row').slice(1).map((r) => r.querySelector('td')?.textContent);
    expect(urls).toEqual(['https://a.test/lo', 'https://a.test/mid', 'https://a.test/hi', 'https://a.test/skip']);
    expect(screen.getByText('Not an HTML page')).toBeTruthy();
    expect(screen.getByText('65').className).toContain('amber');
    expect(screen.getByText('90').className).toContain('emerald');
    expect(screen.getByText('20').className).toContain('rose');
  });

  it('breaks score ties by url', () => {
    render(<AioPagesTable pages={[row('https://a.test/b', 50), row('https://a.test/a', 50)]} />);
    expect(screen.getAllByRole('row')[1].textContent).toContain('/a');
  });
});

describe('CrawlAioTab without weak passages', () => {
  it('says no weak passages were found', () => {
    render(<CrawlAioTab pages={[aioPage('https://a.test/g', [GOOD])]} />);
    expect(screen.getByText('No weak passages found.')).toBeTruthy();
    expect(screen.getByText(/No weak passages found across 1/)).toBeTruthy();
  });
});

describe('integration points', () => {
  it('registers the tab in the core group and as a report section', () => {
    expect(tabs.some((tab) => tab.id === 'aio')).toBe(true);
    expect(tabGroupForTab('aio')).toBe('core');
    expect(REPORT_TEMPLATE_SECTIONS).toContain('aio');
  });

  it('sends the AI readiness summary with the PDF run payload when the template allows it', async () => {
    vi.mocked(invokeTauriCommand).mockResolvedValue(btoa('%PDF-1.7'));
    const run = createCrawlRunFixture({ result: createCrawlResultFixture({ pages: [GOOD_PAGE, WEAK_PAGE, aioPage('u', undefined)] }) });
    const sentAt = (index: number) => (vi.mocked(invokeTauriCommand).mock.calls[index][1] as { run: Record<string, unknown> }).run;
    await downloadCrawlPdf(run);
    expect(sentAt(0).aio).toMatchObject({ band: expect.any(String), pages: expect.any(Array), passages: expect.any(Array) });
    const template = { id: 't', name: 'T', createdAt: '', updatedAt: '' };
    await downloadCrawlPdf(run, { ...template, sections: ['summary', 'aio'] });
    expect(sentAt(1).aio).toBeDefined();
    await downloadCrawlPdf(run, { ...template, sections: ['summary'] });
    expect(sentAt(2)).not.toHaveProperty('aio');
    await downloadCrawlPdf(createCrawlRunFixture({ result: createCrawlResultFixture({ pages: [] }) }));
    expect(sentAt(3)).not.toHaveProperty('aio');
  });
});
