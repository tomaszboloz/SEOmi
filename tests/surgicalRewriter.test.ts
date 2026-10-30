import { describe, expect, it } from 'vitest';
import { simulateImprovement, type PageFocus, type SiteFocusReport } from '@/services/siteFocus';
import { buildSurgicalPagePrescription, firstSentenceOf, semanticSections, surgicalAfterHtml } from '@/services/surgicalRewriter';
import type { RagSection } from '@/types/crawl/focus';

const section = (heading: string, level: number, paragraphs: string[], extra: Partial<RagSection> = {}): RagSection => ({ heading, level, paragraphs, tables: 0, ordered_lists: 0, unordered_lists: 0, definition_lists: 0, ...extra });
const url = 'https://a.pl/kawa';
const page = {
  url, document_language: 'pl',
  rag_sections: [
    section('Kawa ziarnista', 1, ['Kawa ziarnista to podstawa.']),
    section('Zalety i efekty stosowania', 2, ['To sprawia, że dzień jest lepszy. Drugie zdanie.']),
    section('Wybór kawy', 2, ['Kawa arabika i kawa robusta różnią się smakiem.'], { tables: 1 }),
    section('Nasze rowery', 3, ['Rower górski, rower miejski i rower szosowy w promocji.'], { unordered_lists: 1 }),
  ],
};
const focusPage = (patch: Partial<PageFocus> = {}): PageFocus => ({ url, type: 'article', weight: 1, trs: 40, offTopicKeywords: [{ term: 'rower', count: 3, cluster: 'x' }], ...patch }) as PageFocus;
const other = { url: 'https://a.pl/b', type: 'article', weight: 1, trs: 90 } as PageFocus;
const report = (pages: PageFocus[] = [focusPage(), other]) => ({
  score: 65, pages, model: { language: 'pl' },
  coreTopic: { label: 'kawa', terms: [{ term: 'kawa', weight: 3, coveragePct: 90 }, { term: 'arabika', weight: 2, coveragePct: 50 }, { term: 'palenie', weight: 1, coveragePct: 40 }] },
}) as unknown as SiteFocusReport;

describe('semantic sections (#127)', () => {
  it('projects rag_sections with first sentence, words, terms and structure flags', () => {
    const sections = semanticSections(page);
    expect(sections[1]).toMatchObject({ index: 1, level: 2, firstSentence: 'To sprawia, że dzień jest lepszy.', wordCount: 8, hasTable: false, hasList: false });
    expect(sections[2].hasTable).toBe(true);
    expect(sections[3].hasList).toBe(true);
    expect(sections[3].terms[0]).toBe('rower');
    expect(semanticSections({})).toEqual([]);
    expect(firstSentenceOf('Bez kropki')).toBe('Bez kropki');
  });
});

describe('buildSurgicalPagePrescription (#127)', () => {
  it('points to the weakest H2, lists missing entities, drift and a dangling opener', () => {
    const result = buildSurgicalPagePrescription(page, focusPage(), report());
    expect(result.status).toBe('ready');
    expect(result.target).toMatchObject({ index: 1, heading: 'Zalety i efekty stosowania', position: 2, coreHits: 0 });
    expect(result.target?.before.firstSentence).toBe('To sprawia, że dzień jest lepszy.');
    expect(result.missingTerms).toEqual(['palenie']);
    expect(result.headingEntity).toBe('palenie');
    expect(result.danglingOpener).toBe('to');
    expect(result.drift.map((item) => item.heading)).toEqual(['Nasze rowery']);
    expect(result.drift[0].foreignTerms).toEqual(['rower']);
  });

  it('takes the forecast from the SFS engine, not a fixed bonus', () => {
    const pages = [focusPage(), other];
    const result = buildSurgicalPagePrescription(page, pages[0], report(pages));
    expect(result.forecast).toEqual({ currentSfs: 65, projectedSfs: simulateImprovement(pages, [url]), delta: Math.round((simulateImprovement(pages, [url]) - 65) * 10) / 10 });
    expect(buildSurgicalPagePrescription(page, focusPage({ trs: 95 }), report()).forecast).toBeNull();
  });

  it('reports missing sections and pages with nothing to fix', () => {
    expect(buildSurgicalPagePrescription({ url, rag_sections: [section('H1', 1, ['x'])] }, focusPage(), report()).status).toBe('no-sections');
    const clean = { url, rag_sections: [section('Kawa arabika', 2, ['Kawa arabika i palenie kawy.'])] };
    expect(buildSurgicalPagePrescription(clean, focusPage({ offTopicKeywords: [] }), report()).status).toBe('nothing-to-fix');
  });

  it('escapes the copied After HTML', () => {
    expect(surgicalAfterHtml({ level: 3, heading: 'A <b>', answerFirst: 'x & y', original: '"q"' })).toBe('<h3>A &lt;b&gt;</h3>\n<p>x &amp; y</p>\n<p>&quot;q&quot;</p>');
    expect(surgicalAfterHtml({ level: 2, heading: 'H', answerFirst: 'A', original: '' })).toBe('<h2>H</h2>\n<p>A</p>');
  });
});
