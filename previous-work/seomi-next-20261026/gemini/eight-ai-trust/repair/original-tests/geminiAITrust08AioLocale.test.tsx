import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AioHero } from '@/components/Domain/crawlResults/aio/AioHero';
import { AioPassageCard } from '@/components/Domain/crawlResults/aio/AioPassageCard';
import i18n from '@/i18n';
import type { AioReport, AioSnapshot } from '@/services/aioReadiness';
import { rewritePassage } from '@/services/aioReadiness';

vi.mock('@/services/aioReadiness', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/aioReadiness');
  return { ...actual, rewritePassage: vi.fn() };
});

const LOCALES = ['en', 'pl', 'es', 'de', 'fr', 'it', 'pt', 'ru', 'ja', 'zh', 'ko', 'ar'] as const;

const makeReport = (extra: Partial<AioReport> = {}): AioReport => ({
  score: 82,
  band: 'good',
  scoredCount: 14,
  skippedCount: 3,
  weakPassages: [],
  selfContainment: 85,
  spoDensity: 78,
  extractability: 84,
  basicRuleLanguages: [],
  pages: [],
  ...extra,
});

const samplePassage = {
  url: 'https://site.test/docs/guide',
  windowIndex: 0,
  tokens: 110,
  score: 42,
  issues: ['low-spo'] as any,
  text: 'Sample passage text without self-contained context.',
  heading: 'Section 1',
};

beforeEach(async () => {
  await i18n.changeLanguage('en');
  vi.clearAllMocks();
});

describe('geminiAITrust08 - AioHero 12-locale mounting & disclosure', () => {
  it.each(LOCALES)('mounts AioHero with localized band, keyboard labels, and HelpTips in %s', async (lang) => {
    await i18n.changeLanguage(lang);
    const prev: AioSnapshot = { score: 72, band: 'average', createdAt: '2026-10-01' } as any;
    render(<AioHero report={makeReport({ basicRuleLanguages: ['ja', 'zh'] })} previous={prev} />);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain(i18n.t('aio.hero.label'));
    const expectedBand = i18n.t('aio.band.good');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', `82 ${expectedBand}`);
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
      expect(screen.getAllByRole('status').some((el) => el.textContent === i18n.t('aio.passage.noKey'))).toBe(true);
    });
  });

  it('falls back to noHeading translation and announces empty and error statuses', async () => {
    vi.mocked(rewritePassage).mockResolvedValueOnce({ status: 'empty' });
    const { rerender } = render(<AioPassageCard passage={{ ...samplePassage, heading: '' }} index={1} />);
    expect(screen.getByText(new RegExp(i18n.t('aio.passage.noHeading')))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: `${i18n.t('aio.passage.generate')} 2` }));
    await vi.waitFor(() => {
      expect(screen.getAllByRole('status').some((el) => el.textContent === i18n.t('aio.passage.empty'))).toBe(true);
    });

    vi.mocked(rewritePassage).mockResolvedValueOnce({ status: 'error', message: 'Quota exceeded' });
    rerender(<AioPassageCard passage={samplePassage} index={1} />);
    fireEvent.click(screen.getByRole('button', { name: `${i18n.t('aio.passage.generate')} 2` }));
    await vi.waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(i18n.t('aio.passage.error', { message: 'Quota exceeded' }));
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
