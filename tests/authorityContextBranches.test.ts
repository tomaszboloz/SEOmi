import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSiteFocusReport, type FocusPage } from '@/services/siteFocus';
import { buildContext, gatedSiteFocus } from '@/services/topicalAuthority/context';
import { coffeePage, NOW } from './authorityFixtures';

vi.mock('@/services/siteFocus', async (original) => ({
  ...await original<typeof import('@/services/siteFocus')>(), buildSiteFocusReport: vi.fn(),
}));

const actual = await vi.importActual<typeof import('@/services/siteFocus')>('@/services/siteFocus');
const start = 'https://context.test/';
const pages = [coffeePage('context.test', { path: '/coffee', title: 'Coffee espresso', date: '2026-09-01' })];
const report = actual.buildSiteFocusReport(pages, start, { now: NOW });
const rebuild = vi.mocked(buildSiteFocusReport);
beforeEach(() => { rebuild.mockReset().mockReturnValue(report); });

describe('direct authority context fallbacks', () => {
  it('passes a manual override and an absent model language through the gate', () => {
    const input = { ...report, coreTopic: { ...report.coreTopic, manualOverride: { input: ' coffee ' } },
      model: { ...report.model, language: '' } } as typeof report;
    expect(gatedSiteFocus(pages, start, input).pages).toHaveLength(1);
    expect(rebuild).toHaveBeenCalledWith(pages, start, expect.objectContaining({ manualTopic: 'coffee', language: undefined }));
  });

  it.each(['', 'en'])('uses the empty-language fallback when rebuilding yields none (original=%s)', (language) => {
    rebuild.mockReturnValue({ ...report, model: { ...report.model, language: '' } });
    const input = { ...report, model: { ...report.model, language } };
    expect(buildContext(pages, start, input).language).toBe('');
  });

  it('matches redirected pages using the final URL when the original has no focus entry', () => {
    const redirected = { ...pages[0], final_url: `${start}final` };
    rebuild.mockReturnValue({ ...report, pages: [{ ...report.pages[0], url: redirected.final_url }] });
    expect(buildContext([redirected], start, report).pages[0].url).toBe(redirected.final_url);
  });

  it('uses the original URL and empty heading/title fallbacks without fabricating a date', () => {
    const sparse = { ...pages[0], final_url: '', title: '', heading_texts: undefined, content_date: undefined };
    const [entry] = buildContext([sparse], start, report).pages;
    expect(entry).toMatchObject({ url: pages[0].url, date: undefined });
    expect(entry.h1.size).toBe(0);
    expect(entry.zone.size).toBe(0);
    expect(entry.headings).toEqual([]);
    const untitled = { ...sparse, title: undefined, heading_texts: { h1: [], h2: ['Espresso'], h3: undefined } } as unknown as FocusPage;
    expect(buildContext([untitled], start, report).pages[0].headings).toHaveLength(1);
  });

  it.each([false, true])('ignores a missing or skipped rebuilt focus entry (skipped=%s)', (skipped) => {
    rebuild.mockReturnValue({ ...report, pages: skipped ? [{ ...report.pages[0], skipped: 'no-content' }] : [] });
    expect(buildContext(pages, start, report).pages).toEqual([]);
  });
});
