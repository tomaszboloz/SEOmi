import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AioLanguageNote } from '@/components/Domain/crawlResults/aio/AioLanguageNote';
import { AioPagesTable } from '@/components/Domain/crawlResults/aio/AioPagesTable';
import i18n from '@/i18n';
import { aioLanguageStatusGroups, type AioPageReport } from '@/services/aioReadiness';

const page = (url: string, language: string, languageStatus?: AioPageReport['languageStatus'], skipped?: AioPageReport['skipped']): AioPageReport => ({
  url, score: 70, selfContainment: 70, spoDensity: 70, extractability: 70, language, coverage: languageStatus === 'supported' ? 'full' : 'basic',
  languageStatus, chunkCount: 2, danglingCount: 0, tripleCount: 1, wordCount: 120, weakChunks: [], skipped,
});

afterEach(async () => { await i18n.changeLanguage('en'); });

describe('AIO language status groups (#108)', () => {
  it('separates uncertain from unsupported languages and ignores skipped pages', () => {
    const groups = aioLanguageStatusGroups({ pages: [
      page('a', 'en', 'supported'), page('b', 'de', 'uncertain'), page('c', 'de', 'uncertain'),
      page('d', 'hu', 'unsupported'), page('e', 'fi', 'unsupported', 'no-sections'), page('f', '', 'unsupported'),
    ] });
    expect(groups).toEqual({ uncertain: ['de'], unsupported: ['hu', 'und'] });
  });

  it('returns undefined for stored reports without per-page status', () => {
    expect(aioLanguageStatusGroups({ pages: [page('a', 'de')] })).toBeUndefined();
    expect(aioLanguageStatusGroups({ pages: undefined as never })).toBeUndefined();
  });
});

describe('AioLanguageNote', () => {
  it('labels uncertain and fallback languages separately', () => {
    render(<AioLanguageNote report={{ basicRuleLanguages: ['de', 'hu'], pages: [page('b', 'de', 'uncertain'), page('d', 'hu', 'unsupported'), page('e', 'und', 'unsupported')] }} />);
    const note = screen.getByTestId('aio-language-note');
    expect(note.textContent).toContain(i18n.t('aio.languageStatus.uncertain', { languages: 'de' }));
    expect(note.textContent).toContain(i18n.t('aio.languageStatus.unsupported', { languages: `hu, ${i18n.t('aio.languageStatus.undetermined')}` }));
  });

  it('renders nothing when every scored language is supported', () => {
    const { container } = render(<AioLanguageNote report={{ basicRuleLanguages: [], pages: [page('a', 'pl', 'supported')] }} />);
    expect(container.innerHTML).toBe('');
  });

  it('keeps the legacy basic-rules note for reports without status', () => {
    render(<AioLanguageNote report={{ basicRuleLanguages: ['ja'], pages: [page('a', 'ja')] }} />);
    expect(screen.getByRole('note').textContent).toBe(i18n.t('aio.basicNote', { languages: 'ja' }));
  });

  it('is translated in Polish', async () => {
    await i18n.changeLanguage('pl');
    render(<AioLanguageNote report={{ basicRuleLanguages: [], pages: [page('d', 'hu', 'unsupported')] }} />);
    expect(screen.getByRole('note').textContent).toContain('Brak reguł językowych dla hu');
  });
});

describe('AioPagesTable language column', () => {
  it('marks uncertain and fallback languages but not supported ones', () => {
    render(<AioPagesTable pages={[page('https://a.test/', 'en', 'supported'), page('https://b.test/', 'de', 'uncertain'), page('https://c.test/', 'hu', 'unsupported')]} />);
    expect(screen.getByText(`· ${i18n.t('aio.languageStatus.short.uncertain')}`)).toBeTruthy();
    expect(screen.getByText(`· ${i18n.t('aio.languageStatus.short.unsupported')}`)).toBeTruthy();
    expect(screen.getAllByText(/^· /)).toHaveLength(2);
  });
});
