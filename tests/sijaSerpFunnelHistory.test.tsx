import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { parseFeatures } from '@/services/sija/features';
import { formatGaps } from '@/services/sija/formatGaps';
import { analyzePhraseIntent, intentMatchOf, serpIntentOf } from '@/services/sija/phraseIntent';
import { classify } from '@/services/sija/classify';
import { loadSijaHistory, recordSijaRun } from '@/services/sija/history';
import { TargetPhraseIntentSection } from '@/components/Results/targetPhraseAudit/TargetPhraseIntentSection';
import type { PageFeatures } from '@/services/sija/types';
import type { TopTenContentGapReport } from '@/services/targetPhraseAudit/types';
import * as rendered from '@/services/tauri/rendered';

const f = (over: Partial<PageFeatures> = {}): PageFeatures => ({ tables: 0, orderedLists: 0, unorderedLists: 0, formInputs: 0, calculators: 0, productCards: 0, localSignals: 0, words: 500, headings: 4, headingText: '', ...over });
const SHOP = '<main><h1>Buy coffee</h1><div class="product"><span>12 €</span> <a href="/cart">Add to cart</a></div></main>';
const HOW_TO = '<nav><a href="/buy">Buy now</a></nav><main><h1>How to brew coffee</h1><ol><li>a</li></ol></main>';

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('calculator evidence and CTA formats (#69 GEM-69-08/09)', () => {
  it('needs working controls and never counts a login form', () => {
    expect(parseFeatures('<form class="calculator"><input type="number"><button>Go</button></form>').functionalCalculators).toBe(1);
    expect(parseFeatures('<form class="calculator-login"><input type="text"><input type="password"><button>Log in</button></form>').functionalCalculators).toBe(0);
    expect(parseFeatures('<div class="mortgage-calculator"><input type="text"></div>')).toMatchObject({ calculators: 1, functionalCalculators: 0 });
  });
  it('counts CTAs in main content only', () => {
    expect(parseFeatures(SHOP).ctas).toBe(1);
    expect(parseFeatures(HOW_TO).ctas).toBe(0);
  });
  it('suggests a calculator only with tool intent and a CTA only when the page side is known', () => {
    const tools = [1, 2, 3].map(() => f({ calculators: 1, functionalCalculators: 1, formInputs: 2 }));
    expect(formatGaps(f(), tools).map((gap) => gap.format)).toEqual(['calculator']);
    const nonFunctional = [1, 2, 3].map(() => f({ calculators: 1, functionalCalculators: 0, formInputs: 2 }));
    expect(formatGaps(f(), nonFunctional)).toEqual([]);
    const withCta = [1, 2, 3].map(() => f({ ctas: 2 }));
    expect(formatGaps(f({ ctas: 0 }), withCta)).toEqual([{ format: 'cta', topPages: 3, analysed: 3 }]);
    expect(formatGaps(f(), withCta)).toEqual([]);
  });
});

describe('intent vs SERP and funnel drill-down (#69 GEM-69-08)', () => {
  it('needs a strict majority and compares with mixed intents', () => {
    const howTo = classify(f({ headingText: 'How to brew', orderedLists: 1 }));
    const compare = classify(f({ headingText: 'A vs B', tables: 1 }));
    expect(serpIntentOf([howTo, howTo, compare])).toEqual({ intent: 'how-to', pages: 2 });
    expect(serpIntentOf([howTo, compare])).toEqual({ intent: null, pages: 0 });
    expect(intentMatchOf(howTo, 'how-to')).toBe('match');
    expect(intentMatchOf(howTo, 'comparison')).toBe('mismatch');
    expect(intentMatchOf(classify(f()), 'how-to')).toBe('unknown');
  });
  it('lists each rendered TOP page with intent and stage', async () => {
    const report = await analyzePhraseIntent('me', ['a', 'b', 'x'], async (url) => { if (url === 'x') throw new Error('fail'); return url === 'me' ? HOW_TO : SHOP; });
    expect(report.serpIntent.intent).toBe('transactional');
    expect(report.intentMatch).toBe('mismatch');
    expect(report.topPages).toEqual([{ url: 'a', intent: 'transactional', stage: 'BOFU' }, { url: 'b', intent: 'transactional', stage: 'BOFU' }]);
  });
});

describe('SIJA history (#69 GEM-69-08)', () => {
  it('stores runs per project and phrase and shows the previous one', async () => {
    const report = await analyzePhraseIntent('me', ['a'], async () => HOW_TO);
    expect(recordSijaRun(null, 'kawa', report, 't0')).toEqual([]);
    recordSijaRun('p1', 'Kawa', report, '2026-10-29T10:00:00Z');
    expect(loadSijaHistory('p1', ' kawa ')).toHaveLength(1);
    expect(loadSijaHistory('p2', 'kawa')).toEqual([]);
    const rows = [{ rank: 1, url: 'https://a.test/', finalUrl: null, availability: 'available' }];
    const top = { phrase: 'kawa', rows, corpus: { target: { url: 'https://me.test/', text: 't', wordCount: 1 }, pages: [], requested: 1 } } as unknown as TopTenContentGapReport;
    const spy = vi.spyOn(rendered, 'renderCrawlPage').mockResolvedValue({ html: HOW_TO, httpStatus: 200 } as rendered.RenderedPageSnapshot);
    render(<TargetPhraseIntentSection report={top} projectId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Analyse search intent' }));
    expect(await screen.findByText(/Previous run 2026-10-29T10:00:00Z: How-to/)).toBeTruthy();
    expect(screen.getByText(/TOP intent: How-to \(1 of 1 rendered pages\)\. Your page matches it/)).toBeTruthy();
    expect(screen.getByText('Rendered TOP pages (1)')).toBeTruthy();
    expect(loadSijaHistory('p1', 'kawa')).toHaveLength(2);
    spy.mockRestore();
  });
});
