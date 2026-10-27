import { describe, expect, it } from 'vitest';
import {
  aioRProfile, buildAioReport, chunkSectionsAioR, extractTriples, extractabilityOf,
  crawlAioSummary, rulesFor, scoreChunk, scorePageAio, selfContainmentOf,
} from '@/services/aioReadiness';
import { section } from './aioFixtures';

const sentence = (words: number, prefix = 'Fact'): string =>
  `${Array.from({ length: words }, (_, index) => `${prefix}${index}`).join(' ')}.`;

describe('AIO-R 0.5 profile', () => {
  it('chunks at sentence boundaries with stable UTF-16 offsets and 250/180/30 limits', () => {
    const text = `${sentence(100, 'a')} ${sentence(100, 'b')} ${sentence(100, 'c')}`;
    const chunks = chunkSectionsAioR([section('Long', [text])]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.offsets?.unit === 'utf16')).toBe(true);
    expect(chunks.every((chunk) => chunk.paragraphs[0].trim().endsWith('.'))).toBe(true);
    expect(chunks[0].tokens).toBeLessThanOrEqual(250);
    expect(chunks[1].offsets?.start).toBeGreaterThan(chunks[0].offsets?.end ?? 0);
  });

  it('keeps a single over-limit sentence as one bounded, explicitly oversized chunk', () => {
    const source = sentence(300);
    const chunks = chunkSectionsAioR([section('Long sentence', [source])]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.oversizedSentence && chunk.tokens <= 250)).toBe(true);
    expect(chunks[0].offsets?.start).toBe(0);
    expect(chunks.at(-1)?.offsets?.end).toBe(source.length);
  });

  it('only calls a pronoun dangling without an in-chunk antecedent and reports deictic spans', () => {
    const rules = rulesFor('en').rules;
    const result = selfContainmentOf({ text: 'CGM sensor measures glucose. It measures glucose here.', heading: 'CGM sensor' }, rules);
    expect(result.dangling).toBe(0);
    expect(result.deictic).toBe(1);
    expect(result.spans.some((span) => span.kind === 'deictic')).toBe(true);
    expect(selfContainmentOf({ text: 'It varies today.', heading: 'CGM sensor' }, rules).dangling).toBe(1);
  });

  it('preserves SPO negation and gives unit facts higher quality', () => {
    const triples = extractTriples('A CGM sensor does not measure glucose for 5 minutes.', rulesFor('en').rules);
    expect(triples[0]).toMatchObject({ negated: true, hasValue: true, quality: 1, unit: 'minutes' });
    expect(scoreChunk({ heading: 'CGM sensor', level: 2, paragraphs: ['A CGM sensor lasts 10 days.'], tokens: 7, windowIndex: 0 }, rulesFor('en').rules).spoDensity).toBeGreaterThan(0);
  });

  it('keeps subsequent answer windows n/a and normalizes extractability inputs', () => {
    const profile = aioRProfile('en', 'PL');
    expect(profile.chunking).toEqual({ maxWords: 250, targetWords: 180, overlapWords: 30 });
    expect(profile.scoreWeights).toEqual({ selfContainment: 0.4, spo: 0.35, answerFirst: 0.25 });
    expect(extractabilityOf([section('H', ['A'], { tables: 1, table_headers: 0, ordered_lists: 1, ordered_list_instruction: false, list_item_word_counts: [40] })])).toBeLessThan(0.1);
    const report = buildAioReport([sectionPage()], { now: '2026-10-27T00:00:00Z', market: 'PL' });
    expect(report.profile.algorithmVersion).toContain('aio-r-');
    expect(report.profile.market).toBe('PL');
  });

  it('keeps numeric partial signals for unknown language without treating unknown anchors as zero', () => {
    const report = scorePageAio({
      url: 'https://example.test/unknown', final_url: 'https://example.test/unknown', http_status: 200,
      semantic_language: 'xx', rag_sections: [section('', ['Sensor lasts 10 days.'])],
    } as never);
    expect(report.score).toBeGreaterThan(0);
    expect(report.languageStatus).toBe('unsupported');
    expect(report.unknownReasons).toEqual(expect.arrayContaining([
      'language-rules-unsupported; lexical signals remain partial',
      'core-anchor-not-supplied; no-entity contribution is unknown',
    ]));
  });

  it('exposes legacy/unversioned profile status in PDF DTOs instead of pretending migration', () => {
    const run = { id: 'legacy', result: { pages: [sectionPage()] } } as never;
    expect(crawlAioSummary(run)?.profile_status).toBe('legacy-unversioned');
    expect(crawlAioSummary(run)?.profile.id).toBe('aio-legacy');
  });
});

const sectionPage = () => ({
  url: 'https://example.test', final_url: 'https://example.test', http_status: 200,
  semantic_language: 'en', rag_sections: [section('H', ['A CGM sensor lasts 10 days.'])],
} as never);
