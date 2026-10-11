import { describe, expect, it } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';
import { sharedInOneLanguage } from '@/services/topicalDiagnosis/similarity';

interface Version { title: string; terms: string[] }
/** One article in Polish and English with reciprocal hreflang: the diagnosis counts it as one document. */
const bilingual = (slug: string, pl: Version, en: Version) => {
  const [plUrl, enUrl] = [`https://ex.test/blog/${slug}/`, `https://ex.test/en/blog/${slug}/`];
  const version = (url: string, other: string, language: string, { title, terms }: Version) => createCrawlPageFixture({
    url, final_url: url, title, semantic_language: language, semantic_terms: terms, word_count: 800, semantic_links: [],
    hreflangs: [{ language: language === 'pl' ? 'en' : 'pl', target_url: other, reciprocal_in_run: true }],
  });
  return [version(plUrl, enUrl, 'pl', pl), version(enUrl, plUrl, 'en', en)];
};
const polish = (slug: string, { title, terms }: Version) => createCrawlPageFixture({
  url: `https://ex.test/blog/${slug}/`, final_url: `https://ex.test/blog/${slug}/`, title, semantic_language: 'pl',
  semantic_terms: terms, word_count: 800, semantic_links: [], hreflangs: [],
});
const codes = (report: ReturnType<typeof buildTopicalDiagnosis>) => report.verdicts.map((verdict) => verdict.code);

describe('thresholds on documents with two language versions', () => {
  it('does not build a topic from one word that both versions share', () => {
    const report = buildTopicalDiagnosis([
      ...bilingual('a', { title: 'A', terms: ['webinar', 'sprzedaż'] }, { title: 'A', terms: ['webinar', 'sales'] }),
      ...bilingual('b', { title: 'B', terms: ['webinar', 'rekrutacja'] }, { title: 'B', terms: ['webinar', 'hiring'] }),
    ], 'https://ex.test/');

    expect(report.stats.documents).toBe(2);
    expect(report.stats.topics).toBe(0);
  });

  it('builds the topic once one language shares two words, as for a single-language pair', () => {
    const bilingualReport = buildTopicalDiagnosis([
      ...bilingual('a', { title: 'A', terms: ['webinar', 'sprzedaż', 'crm'] }, { title: 'A', terms: ['webinar', 'sales', 'crm'] }),
      ...bilingual('b', { title: 'B', terms: ['webinar', 'rekrutacja', 'crm'] }, { title: 'B', terms: ['webinar', 'hiring', 'crm'] }),
    ], 'https://ex.test/');
    const polishReport = buildTopicalDiagnosis([
      polish('a', { title: 'A', terms: ['webinar', 'sprzedaż', 'crm'] }), polish('b', { title: 'B', terms: ['webinar', 'rekrutacja', 'crm'] }),
    ], 'https://ex.test/');

    expect(bilingualReport.stats.topics).toBe(1);
    expect(polishReport.stats.topics).toBe(1);
  });

  it('does not call two articles competitors for two title words repeated in both languages', () => {
    const terms = ['navigator', 'alerty', 'crm', 'licencja'];
    const english = ['navigator', 'alerts', 'crm', 'licence'];
    const report = buildTopicalDiagnosis([
      ...bilingual('a', { title: 'Sales Navigator alerty', terms }, { title: 'Sales Navigator alerts', terms: english }),
      ...bilingual('b', { title: 'Sales Navigator w Teams', terms }, { title: 'Sales Navigator in Teams', terms: english }),
    ], 'https://ex.test/');

    expect(report.stats.topics).toBe(1);
    expect(codes(report)).not.toContain('cannibalization-candidate');
  });

  it('names each shared title word once when one language shares three', () => {
    const terms = ['navigator', 'alerty', 'crm', 'licencja'];
    const english = ['navigator', 'alerts', 'crm', 'licence'];
    const report = buildTopicalDiagnosis([
      ...bilingual('a', { title: 'Alerty Sales Navigatora', terms }, { title: 'Sales Navigator alerts', terms: english }),
      ...bilingual('b', { title: 'Alerty Sales Navigatora w Teams', terms }, { title: 'Sales Navigator alerts in Teams', terms: english }),
    ], 'https://ex.test/');
    const verdict = report.verdicts.find((candidate) => candidate.code === 'cannibalization-candidate');

    expect(verdict?.evidence[1]).toEqual({ key: 'titleTokens', params: { titleTokens: 'alerty, sales, navigatora' } });
  });

  it('picks the language with the most shared keys and keeps their order', () => {
    expect(sharedInOneLanguage(['en:alert', 'en:sales', 'pl:alert', 'pl:navigator', 'pl:sales'])).toEqual(['pl:alert', 'pl:navigator', 'pl:sales']);
    expect(sharedInOneLanguage(['en:sales', 'pl:sales'])).toEqual(['en:sales']);
    expect(sharedInOneLanguage([])).toEqual([]);
  });
});
