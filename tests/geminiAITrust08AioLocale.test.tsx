import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AioHero } from '@/components/Domain/crawlResults/aio/AioHero';
import { AioPassageCard } from '@/components/Domain/crawlResults/aio/AioPassageCard';
import i18n from '@/i18n';
import type { AioChunk, AioReport, AioSnapshot } from '@/services/aioReadiness';
import { buildAioReport, rewritePassage } from '@/services/aioReadiness';

vi.mock('@/services/aioReadiness', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/aioReadiness');
  return { ...actual, rewritePassage: vi.fn() };
});

const LOCALES = ['en', 'pl', 'es', 'de', 'fr', 'it', 'pt', 'ru', 'ja', 'zh', 'ko', 'ar'] as const;

const makeReport = (extra: Partial<AioReport> = {}): AioReport => ({
  ...buildAioReport([]),
  score: 82,
  band: 'good',
  selfContainment: 85,
  spoDensity: 78,
  extractability: 84,
  pages: [],
  scoredCount: 14,
  skippedCount: 3,
  weakPassages: [],
  basicRuleLanguages: [],
  generatedAt: '2026-10-20T00:00:00.000Z',
  pageCount: 17,
  version: 1,
  ...extra,
});

const samplePassage: AioChunk & { url: string } = {
  url: 'https://site.test/docs/guide',
  heading: 'Section 1',
  level: 2,
  text: 'Sample passage text without self-contained context.',
  tokens: 110,
  windowIndex: 0,
  score: 42,
  selfContainment: 40,
  answerFirst: 30,
  triples: 2,
  issues: ['no-facts'],
};

beforeEach(async () => {
  await i18n.changeLanguage('en');
  vi.clearAllMocks();
});

describe('geminiAITrust08 - AioHero 12-locale mounting & disclosure', () => {
  it.each(LOCALES)('mounts AioHero with localized band, keyboard labels, and HelpTips in %s', async (lang) => {
    await i18n.changeLanguage(lang);
    const prev: AioSnapshot = {
      runId: 'run-1',
      at: '2026-10-01T00:00:00.000Z',
      score: 72,
      selfContainment: 70,
      spoDensity: 70,
      extractability: 70,
      scored: 10,
      weakPassages: 0,
    };
    render(<AioHero report={makeReport({ basicRuleLanguages: ['ja', 'zh'] })} previous={prev} />);

    expect(screen.getByText(i18n.t('aio.hero.label'))).toBeTruthy();
    const expectedBand = i18n.t('aio.band.good');
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar.getAttribute('aria-label')).toBe(`82 ${expectedBand}`);
    expect(progressBar.getAttribute('aria-valuenow')).toBe('82');
    expect(screen.getByTestId('aio-score').textContent).toBe('82');

    const note = screen.getByRole('note');
    expect(note.textContent).toContain('ja, zh');
    expect(note.textContent).toBe(i18n.t('aio.basicNote', { languages: 'ja, zh' }));

    for (const id of ['aio.aioReadiness', 'aio.selfContainment', 'aio.spoDensity', 'aio.extractability']) {
      const tip = document.querySelector(`button[data-help-id="${id}"]`);
      expect(tip).not.toBeNull();
      expect(tip?.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('omits model source disclosure note when no basic rule languages are used', () => {
    render(<AioHero report={makeReport({ basicRuleLanguages: [] })} />);
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('geminiAITrust08 - AioPassageCard keyboard actions & status announcements', () => {
  it.each(LOCALES)('renders localized keyboard generate action and handles no-key in %s', async (lang) => {
    await i18n.changeLanguage(lang);
    vi.mocked(rewritePassage).mockResolvedValueOnce({ status: 'no-key' });

    render(<AioPassageCard passage={samplePassage} index={0} />);
    const genBtn = screen.getByRole('button', { name: `${i18n.t('aio.passage.generate')} 1` });
    expect(genBtn).toBeTruthy();

    fireEvent.click(genBtn);
    await vi.waitFor(() => {
      const el = screen.getByText(i18n.t('aio.passage.noKey'));
      expect(el.getAttribute('role')).toBe('status');
    });
  });

  it('falls back to noHeading translation and announces empty and error statuses', async () => {
    vi.mocked(rewritePassage).mockResolvedValueOnce({ status: 'empty' });
    const { rerender } = render(<AioPassageCard passage={{ ...samplePassage, heading: '' }} index={1} />);
    expect(screen.getByText(new RegExp(i18n.t('aio.passage.noHeading')))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: `${i18n.t('aio.passage.generate')} 2` }));
    await vi.waitFor(() => {
      const emptyEl = screen.getByText(i18n.t('aio.passage.empty'));
      expect(emptyEl.getAttribute('role')).toBe('status');
    });

    vi.mocked(rewritePassage).mockResolvedValueOnce({ status: 'error', message: 'Quota exceeded' });
    rerender(<AioPassageCard passage={samplePassage} index={1} />);
    fireEvent.click(screen.getByRole('button', { name: `${i18n.t('aio.passage.generate')} 2` }));
    await vi.waitFor(() => {
      const alertEl = screen.getByText(i18n.t('aio.passage.error', { message: 'Quota exceeded' }));
      expect(alertEl.getAttribute('role')).toBe('alert');
    });
  });

  it('renders optimized rewrite block and copies text to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    vi.mocked(rewritePassage).mockResolvedValueOnce({ status: 'ok', text: 'Rewritten text clear & concise.' });

    render(<AioPassageCard passage={samplePassage} index={0} />);
    fireEvent.click(screen.getByRole('button', { name: `${i18n.t('aio.passage.generate')} 1` }));
    await vi.waitFor(() => {
      expect(screen.getByTestId('aio-optimized')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: i18n.t('aio.passage.copy') }));
    expect(writeText).toHaveBeenCalledWith('Rewritten text clear & concise.');
  });
});
