import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { analyzePhraseIntent, PHRASE_INTENT_TOP } from '@/services/sija/phraseIntent';
import { TargetPhraseIntentSection } from '@/components/Results/targetPhraseAudit/TargetPhraseIntentSection';
import type { TopTenContentGapReport } from '@/services/targetPhraseAudit/types';
import * as rendered from '@/services/tauri/rendered';

const HOW_TO = '<main><h1>How to brew coffee</h1><ol><li>a</li></ol><p>text</p></main>';
const COMPARE = '<main><h2>Chemex vs V60</h2><table><tr><td>x</td></tr></table></main>';

describe('SIJA for the audited phrase (#69)', () => {
  it('classifies the page, counts rendered TOP pages and skips failures without guessing', async () => {
    const html: Record<string, string> = { me: HOW_TO, a: HOW_TO, b: COMPARE, c: HOW_TO };
    const fetchHtml = vi.fn(async (url: string) => { if (!html[url]) throw new Error('render failed'); return html[url]; });
    const report = await analyzePhraseIntent('me', ['a', 'b', 'c', 'd', 'e', 'f'], fetchHtml);
    expect(fetchHtml).toHaveBeenCalledTimes(1 + PHRASE_INTENT_TOP);
    expect(report.page.primary).toBe('how-to');
    expect(report).toMatchObject({ requested: 5, analysed: 3, funnel: { TOFU: 2, MOFU: 1, BOFU: 0 } });
    expect(report.ssas.score).not.toBeNull();
  });

  it('renders through the desktop WebView and rejects error statuses', async () => {
    const spy = vi.spyOn(rendered, 'renderCrawlPage');
    spy.mockResolvedValueOnce({ html: HOW_TO, httpStatus: 200 } as rendered.RenderedPageSnapshot);
    spy.mockResolvedValueOnce({ html: '', httpStatus: 404 } as rendered.RenderedPageSnapshot);
    const report = await analyzePhraseIntent('https://me.test/', ['https://gone.test/']);
    expect(report.analysed).toBe(0);
    expect(report.ssas.status).toBe('inconclusive');
    spy.mockRestore();
  });

  it('starts only on the button and shows the result or a failure', async () => {
    await i18n.changeLanguage('en');
    const report = { rows: [{ rank: 1, url: 'https://a.test/', finalUrl: null, availability: 'available' }], corpus: { target: { url: 'https://me.test/', text: 't', wordCount: 1 }, pages: [], requested: 1 } } as unknown as TopTenContentGapReport;
    const spy = vi.spyOn(rendered, 'renderCrawlPage').mockResolvedValue({ html: HOW_TO, httpStatus: 200 } as rendered.RenderedPageSnapshot);
    render(<TargetPhraseIntentSection report={report} />);
    expect(spy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Analyse search intent' }));
    expect(await screen.findByText(/TOP pages rendered: 1 of 1/)).toBeTruthy();
    expect(screen.getByText(/Observed intent: How-to/)).toBeTruthy();
    spy.mockRejectedValue(new Error('down'));
    fireEvent.click(screen.getByRole('button', { name: 'Analyse search intent' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    spy.mockRestore();
  });

  it('keeps the button disabled without a target page or TOP rows', () => {
    render(<TargetPhraseIntentSection report={null} />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
