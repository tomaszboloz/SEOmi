import { describe, expect, it } from 'vitest';
import { buildBaseline, buildIgosReport, evaluatePage } from '@/services/informationGain';
import { cosine, entitiesOf, termCounts, vectorize, buildIdf, centroidOf } from '@/services/informationGain/text';
import { subtopicDivergence } from '@/services/informationGain/divergence';
import { zoneOf } from '@/services/informationGain/sections';
import { countMatches, EMPIRICAL_PATTERNS, markersFor, phrasesIn } from '@/services/informationGain/signals';
import { DRIFT_SECTION, ECHO_SECTION, GAIN_SECTION, SERP_DOCS, competitor, page, section } from './informationGainFixtures';

const NOW = '2026-10-16T00:00:00.000Z';
const baseline = () => buildBaseline(SERP_DOCS, 'en');

describe('baseline', () => {
  it('needs at least two readable documents and flags a thin one', () => {
    expect(buildBaseline([competitor('https://a.example/', 1)], 'en')).toBeNull();
    expect(buildBaseline([competitor('https://a.example/', 1), { url: 'https://b.example/', sections: [] }], 'en')).toBeNull();
    const result = baseline();
    expect(result?.docs).toBe(5);
    expect(result?.thin).toBe(false);
    expect(buildBaseline(SERP_DOCS.slice(0, 2), 'en')?.thin).toBe(true);
    expect(result?.consensus.size).toBeGreaterThan(5);
    expect(result?.avgTables).toBe(0);
  });
});

describe('text vectors', () => {
  it('stems entities and builds normalised comparable vectors', () => {
    expect([...entitiesOf('Sensors measure glucose levels', 'en').keys()]).toContain('sensor');
    expect(entitiesOf('a an of', 'en').size).toBe(0);
    const counts = [termCounts('glucose sensor glucose', 'en'), termCounts('mortgage bank', 'en')];
    const idf = buildIdf(counts);
    const [a, b] = counts.map((count) => vectorize(count, idf));
    expect(cosine(a, a)).toBeCloseTo(1, 5);
    expect(cosine(a, b)).toBe(0);
    expect(centroidOf([a, b]).size).toBe(a.size + b.size);
    expect(vectorize(new Map(), idf).size).toBe(0);
  });
});

describe('section gate', () => {
  it('classifies Echo, Information Gain and Drift by the two similarities', () => {
    const limits = { echo: 0.55, topic: 0.15 };
    expect(zoneOf(0.9, 0.9, limits)).toBe('echo');
    expect(zoneOf(0.3, 0.4, limits)).toBe('gain');
    expect(zoneOf(0.05, 0.05, limits)).toBe('drift');
  });

  it('copied text is Echo, own research is Gain, unrelated text is Drift', () => {
    const result = evaluatePage(page('https://own.example/a', [ECHO_SECTION, GAIN_SECTION, DRIFT_SECTION]), baseline()!);
    expect(result.sections.map((item) => item.zone)).toEqual(['echo', 'gain', 'drift']);
    const [echo, gain, drift] = result.sections;
    expect(echo.novelty).toBeLessThan(gain.novelty);
    expect(drift.novelty).toBe(0);
    expect(drift.novelEntities).toEqual([]);
    expect(gain.firstHand).toBe(true);
    expect(gain.facts).toBeGreaterThan(3);
    expect(echo.closestUrl).toMatch(/example/);
    expect(result.zones).toEqual({ echo: 33, gain: 33, drift: 33 });
  });
});

describe('page score', () => {
  it('rewards original, evidenced pages over copied ones', () => {
    const copied = evaluatePage(page('https://own.example/copy', [ECHO_SECTION, section('How to insert the sensor', SERP_DOCS[0].sections[1].text)]), baseline()!);
    const original = evaluatePage(page('https://own.example/new', [ECHO_SECTION, GAIN_SECTION, section('Night readings', 'We measured the reading error each night: 11,4% in the first 12 h and 8,2% afterwards, doi:10.1000/xyz, ISO 15197.', { tables: 1 })]), baseline()!);
    expect(original.score).toBeGreaterThan(copied.score);
    expect(copied.recommendations.map((item) => item.code)).toEqual(expect.arrayContaining(['rewrite-echo-sections', 'add-first-hand', 'add-data']));
    expect(original.parts.fhem).toBeGreaterThan(0);
    expect(original.experiencePhrases.length).toBeGreaterThan(0);
    expect(original.novelEntities.length).toBeGreaterThan(0);
    expect(original.band).toBe(original.score >= 55 ? (original.score >= 75 ? 'original' : 'good') : original.score >= 35 ? 'average' : 'derivative');
  });

  it('applies the foundation penalty when basic consensus entities are missing', () => {
    const own = evaluatePage(page('https://own.example/rare', [GAIN_SECTION]), baseline()!);
    expect(own.baseCoverage).toBeLessThan(50);
    expect(own.foundationMultiplier).toBeCloseTo(0.5 + own.baseCoverage / 100, 1);
    expect(own.missingConsensus.length).toBeGreaterThan(0);
    expect(own.recommendations.some((item) => item.code === 'fill-consensus')).toBe(true);
    const full = evaluatePage(page('https://own.example/full', SERP_DOCS[0].sections), baseline()!);
    expect(full.foundationMultiplier).toBe(1);
  });

  it('skips pages without sections and renormalises when the language has no experience markers', () => {
    expect(evaluatePage(page('https://own.example/none', []), baseline()!).skipped).toBe('no-sections');
    const withMarkers = evaluatePage(page('https://own.example/en', [GAIN_SECTION]), baseline()!);
    const noMarkers = evaluatePage(page('https://own.example/uk', [GAIN_SECTION], 'uk'), baseline()!);
    expect(noMarkers.parts.fhem).toBeNull();
    expect(noMarkers.score).toBeGreaterThanOrEqual(0);
    expect(withMarkers.parts.fhem).not.toBeNull();
    expect(noMarkers.recommendations.some((item) => item.code === 'add-first-hand')).toBe(false);
  });

  it('reports drift sections for removal', () => {
    const result = evaluatePage(page('https://own.example/d', [GAIN_SECTION, DRIFT_SECTION]), baseline()!);
    expect(result.recommendations.find((item) => item.code === 'remove-drift-sections')?.params.count).toBe(1);
  });
});

describe('divergence and signals', () => {
  it('is neutral without enough anchors and bounded otherwise', () => {
    expect(subtopicDivergence([], [])).toBe(0.5);
    const base = baseline()!;
    const vecs = base.chunks.map((chunk) => chunk.vec);
    const same = subtopicDivergence(vecs, vecs);
    expect(same).toBeCloseTo(0, 5);
    const other = subtopicDivergence([vecs[0]], vecs);
    expect(other).toBeGreaterThan(same);
    expect(other).toBeLessThanOrEqual(1);
  });

  it('detects measured data, sources and first-hand phrases in several languages', () => {
    expect(countMatches('70-99 mg/dl, 8.2%, n = 24, doi:10.1/x, randomized trial', EMPIRICAL_PATTERNS)).toBeGreaterThanOrEqual(5);
    expect(countMatches('nothing numeric here', EMPIRICAL_PATTERNS)).toBe(0);
    expect(phrasesIn('W naszych testach zaobserwowaliśmy spadek', markersFor('pl')!)).toEqual(['w naszych testach', 'zaobserwowaliśmy']);
    for (const [language, text] of [['de', 'In unseren Tests'], ['es', 'En nuestras pruebas'], ['fr', 'Lors de nos tests'], ['it', 'Nei nostri test'], ['pt', 'Nos nossos testes'], ['ru', 'В наших тестах']]) {
      expect(markersFor(language)?.test(text)).toBe(true);
      markersFor(language)!.lastIndex = 0;
    }
    expect(markersFor('ja')).toBeUndefined();
    expect(markersFor('en-GB')).toBeDefined();
  });
});

describe('site report', () => {
  const pages = [
    page('https://own.example/copy', [ECHO_SECTION], 'en'),
    page('https://own.example/new', [ECHO_SECTION, GAIN_SECTION], 'en'),
    page('https://own.example/empty', []),
  ];

  it('returns null without a usable baseline and never invents a consensus', () => {
    expect(buildIgosReport({ pages, baselineDocs: [] })).toBeNull();
    expect(buildIgosReport({ pages, baselineDocs: SERP_DOCS.slice(0, 1) })).toBeNull();
  });

  it('averages page scores, orders the worst first and aggregates recommendations', () => {
    const report = buildIgosReport({ pages, baselineDocs: SERP_DOCS.slice(0, 2), queries: ['glucose sensor'], source: 'bing-rss', now: NOW })!;
    expect(report.evaluated).toBe(2);
    expect(report.skipped).toBe(1);
    expect(report.pages[0].score).toBeLessThanOrEqual(report.pages[1].score);
    expect(report.score).toBe(Math.round((report.pages[0].score + report.pages[1].score) / 2));
    expect(report.baseline).toMatchObject({ docs: 2, thin: true, queries: ['glucose sensor'], source: 'bing-rss' });
    expect(report.recommendations[0].code).toBe('collect-baseline');
    expect(report.generatedAt).toBe(NOW);
    expect(report.fhemUnavailablePages).toBe(0);
    expect(report.zones.echo + report.zones.gain + report.zones.drift).toBeGreaterThan(0);
  });

  it('caps evaluated pages, picking the longest first, and reports truncation', () => {
    const many = Array.from({ length: 160 }, (_, i) => ({ ...page(`https://own.example/p${i}`, [GAIN_SECTION]), word_count: i }));
    const report = buildIgosReport({ pages: many, baselineDocs: SERP_DOCS, language: 'en' })!;
    expect(report.evaluated).toBe(150);
    expect(report.truncated).toBe(10);
    expect(report.pages.every((item) => item.url !== 'https://own.example/p0')).toBe(true);
    expect(report.fhemUnavailablePages).toBe(0);
    const unknown = buildIgosReport({ pages: [page('https://own.example/x', [GAIN_SECTION], 'uk')], baselineDocs: SERP_DOCS })!;
    expect(unknown.parts.fhem).toBeNull();
    expect(unknown.fhemUnavailablePages).toBe(1);
  });
});
