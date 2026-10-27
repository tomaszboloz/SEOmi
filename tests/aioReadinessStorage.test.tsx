import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrawlAioTab } from '@/components/Domain/crawlResults/aio/CrawlAioTab';
import { useAioReadiness } from '@/hooks/useAioReadiness';
import i18n from '@/i18n';
import {
  AIO_HISTORY_LIMIT, aioHistoryKey, buildAioReport, readAioHistory, recordAioSnapshot, validAioProject,
} from '@/services/aioReadiness';
import { compactCrawlRunsForStorage } from '@/services/crawlPersistence/compaction';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import { aioPage, GOOD_PAGE, section, WEAK_PAGE } from './aioFixtures';

const generateText = vi.fn();
let connected = true;
vi.mock('@/services/siteFocusBenchmark/adapter', () => ({
  createBriefDeps: () => ({ isConfigured: () => connected, generateText }),
}));

const pages = [GOOD_PAGE, WEAK_PAGE, aioPage('https://a.test/none', undefined)];
const run = (id: string) => createCrawlRunFixture({ id, result: createCrawlResultFixture({ pages }) });

beforeEach(async () => {
  localStorage.clear();
  generateText.mockReset();
  connected = true;
  await i18n.changeLanguage('en');
});

describe('AI readiness history', () => {
  it('validates projects and ignores malformed data', () => {
    expect(validAioProject('../x')).toBe(false);
    expect(readAioHistory('../x')).toEqual([]);
    localStorage.setItem(aioHistoryKey('p1'), '{"a":1}');
    expect(readAioHistory('p1')).toEqual([]);
    localStorage.setItem(aioHistoryKey('p1'), JSON.stringify([null, { runId: 1 }, { runId: 'ok', at: 't', score: 5 }]));
    expect(readAioHistory('p1').map((item) => item.runId)).toEqual(['ok']);
  });

  it('dedupes by run, skips empty reports and caps the list', () => {
    const report = buildAioReport([GOOD_PAGE]);
    expect(recordAioSnapshot('p1', report, 'r1').saved).toBe(true);
    expect(recordAioSnapshot('p1', report, 'r1').saved).toBe(false);
    expect(recordAioSnapshot('p1', buildAioReport([]), 'r2').saved).toBe(false);
    for (let i = 2; i < AIO_HISTORY_LIMIT + 5; i += 1) recordAioSnapshot('p1', report, `r${i}`);
    expect(readAioHistory('p1')).toHaveLength(AIO_HISTORY_LIMIT);
  });
});

describe('useAioReadiness', () => {
  it('builds the report and stores one snapshot per run', () => {
    const { result, rerender } = renderHook(({ id }) => useAioReadiness(pages, run(id), 'p1'), { initialProps: { id: 'r1' } });
    expect(result.current.report.scoredCount).toBe(2);
    expect(result.current.history).toHaveLength(1);
    rerender({ id: 'r2' });
    expect(result.current.history).toHaveLength(2);
  });

  it('only reads history without a run or a valid project', () => {
    renderHook(() => useAioReadiness(pages, null, 'p1'));
    const { result } = renderHook(() => useAioReadiness(pages, run('r9'), null));
    expect(result.current.history).toEqual([]);
    expect(readAioHistory('p1')).toEqual([]);
  });

  it('does not expose an unversioned legacy snapshot as a comparable trend point', () => {
    localStorage.setItem(aioHistoryKey('p1'), JSON.stringify([{ runId: 'legacy', at: '2026-10-01', score: 99, selfContainment: 99, spoDensity: 99, extractability: 99, scored: 1, weakPassages: 0 }]));
    const { result } = renderHook(() => useAioReadiness([GOOD_PAGE], run('new'), 'p1'));
    expect(result.current.history.map((item) => item.runId)).toEqual(['new']);
  });
});

describe('CrawlAioTab', () => {
  it('shows the empty state when nothing is scoreable', () => {
    render(<CrawlAioTab pages={[aioPage('https://a.test/x', undefined)]} />);
    expect(screen.getByText(/Run a new crawl/)).toBeTruthy();
  });

  it('renders score, passages, pages (with skipped reason) and the history list', () => {
    const { rerender } = render(<CrawlAioTab pages={pages} run={run('r1')} projectId="p1" />);
    expect(screen.getByTestId('aio-score').textContent).toMatch(/\d/);
    expect(screen.getByText(/1 pages skipped/)).toBeTruthy();
    expect(screen.getByText('No content sections (crawled before this feature)')).toBeTruthy();
    expect(screen.getByText('History appears after the second analysis of this project.')).toBeTruthy();
    expect(screen.getAllByTestId('aio-passage').length).toBeGreaterThan(0);
    expect(screen.getByText('Unclear reference')).toBeTruthy();
    rerender(<CrawlAioTab pages={pages} run={run('r2')} projectId="p1" />);
    expect(screen.getAllByRole('listitem').some((item) => /\/|\d{4}|\d+: /.test(item.textContent ?? ''))).toBe(true);
  });

  it('shows the previous-run delta and the basic-language note', () => {
    const profile = buildAioReport([GOOD_PAGE]).profile;
    localStorage.setItem(aioHistoryKey('p1'), JSON.stringify([{ runId: 'old', at: '2026-10-01T00:00:00Z', score: 0, selfContainment: 0, spoDensity: 0, extractability: 0, scored: 1, weakPassages: 0, profile: { id: profile.id, algorithmVersion: profile.algorithmVersion, configHash: profile.configHash, language: profile.language, market: profile.market } }]));
    render(<CrawlAioTab pages={[GOOD_PAGE, aioPage('https://a.test/de', [section('Frage', ['Das ist ein Satz mit Text.'])], { semantic_language: 'de' })]} run={run('r3')} projectId="p1" />);
    expect(screen.getByText(/Change since the previous analysis: \+/)).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('de');
    expect(screen.getByText(/passages found across/)).toBeTruthy();
  });

  it('rewrites a passage with AI, copies it and reports no-key, empty and error states', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CrawlAioTab pages={[WEAK_PAGE]} />);
    const button = screen.getByRole('button', { name: /Rewrite with AI 1/ });
    generateText.mockResolvedValueOnce('Normal post-meal blood glucose is below 140 mg/dl.');
    fireEvent.click(button);
    expect(await screen.findByTestId('aio-optimized')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Normal post-meal blood glucose is below 140 mg/dl.'));
    writeText.mockRejectedValueOnce(new Error('denied'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy' })); });
    generateText.mockResolvedValueOnce('');
    fireEvent.click(button);
    expect(await screen.findByText('The AI returned no text.')).toBeTruthy();
    generateText.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(button);
    expect(await screen.findByText('AI request failed: offline')).toBeTruthy();
    connected = false;
    fireEvent.click(button);
    expect(await screen.findByText(/Connect an AI provider/)).toBeTruthy();
  });
});

describe('storage compaction keeps rag sections bounded', () => {
  it('trims sections and paragraphs per level', () => {
    const sections = Array.from({ length: 45 }, (_, i) => section(`H${i}`, Array.from({ length: 40 }, (_, j) => `p${j}`)));
    const page = createCrawlPageFixture({ rag_sections: sections });
    const source = createCrawlRunFixture({ result: createCrawlResultFixture({ pages: [page, createCrawlPageFixture({ url: 'https://x.test/' })] }) });
    const sizes = ([1, 2, 3] as const).map((level) => compactCrawlRunsForStorage([source], level)[0].result.pages[0].rag_sections ?? []);
    expect(sizes.map((s) => s.length)).toEqual([40, 20, 10]);
    expect(sizes.map((s) => s[0].paragraphs.length)).toEqual([30, 12, 5]);
    expect(compactCrawlRunsForStorage([source], 1)[0].result.pages[1].rag_sections).toBeUndefined();
  });
});
