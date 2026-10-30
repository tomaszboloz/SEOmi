import { describe, expect, it } from 'vitest';
import {
  answerFirstScore, buildAioReport, chunkSectionsAioR, extractTriples, extractabilityOf, rulesFor, scoreChunk,
  scorePageAio, selfContainmentOf, type RawChunk,
} from '@/services/aioReadiness';
import { assessAeoReadiness } from '@/services/briefDocument/aeo';
import { aioPage, GOOD_PAGE, section } from './aioFixtures';

/** Acceptance scenarios GEM-63-T01..T05 of #63, one block per scenario. */
const en = rulesFor('en').rules;
const raw = (paragraphs: string[], heading = 'CGM sensor', windowIndex = 0): RawChunk =>
  ({ heading, level: 2, paragraphs, tokens: paragraphs.join(' ').split(/\s+/).length, windowIndex });

describe('GEM-63-T01 chunking with offsets', () => {
  it('keeps every chunk within 250 words and maps offsets back to the section text', () => {
    const paragraph = Array.from({ length: 40 }, (_, i) => `Sensor ${i} lasts ${i + 1} days in normal use.`).join(' ');
    const source = [paragraph, 'A short closing paragraph.'].join('\n\n');
    const chunks = chunkSectionsAioR([section('Sensors', [paragraph, 'A short closing paragraph.'])]);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.tokens).toBeLessThanOrEqual(250);
      expect(source.slice(chunk.offsets?.start, chunk.offsets?.end)).toBe(chunk.paragraphs[0]);
    });
    expect(chunks.map((chunk) => chunk.windowIndex)).toEqual(chunks.map((_, i) => i));
  });
});

describe('GEM-63-T02 pronouns and Core anchor', () => {
  it('treats a pronoun with an antecedent as resolved and one without as dangling', () => {
    expect(selfContainmentOf({ text: 'The sensor reads glucose. It reads glucose every 5 minutes.', heading: 'CGM' }, en).dangling).toBe(0);
    expect(selfContainmentOf({ text: 'It reads glucose every 5 minutes.', heading: 'Insulin pump' }, en).dangling).toBe(1);
  });

  it('uses supplied Core terms as the anchor and flags a chunk that never names them', () => {
    const missing = selfContainmentOf({ text: 'Readings appear on the phone.', coreTerms: ['CGM'] }, en);
    expect(missing).toMatchObject({ noEntity: true, anchorStatus: 'known' });
    expect(missing.score).toBeCloseTo(0.5);
    expect(selfContainmentOf({ text: 'CGM readings appear on the phone.', coreTerms: ['CGM'] }, en).noEntity).toBe(false);
    expect(selfContainmentOf({ text: 'Readings appear.', heading: '' }, en).anchorStatus).toBe('unknown');
  });
});

describe('GEM-63-T03 facts', () => {
  it('extracts passive and conjoined sentences as at most one fact each', () => {
    const passive = extractTriples('Glucose is measured by the sensor every 5 minutes.', en);
    expect(passive).toHaveLength(1);
    expect(passive[0]).toMatchObject({ subject: 'Glucose', hasValue: true, unit: 'minutes' });
    expect(extractTriples('The sensor lasts 10 days and costs 50 EUR.', en)).toHaveLength(1);
  });

  it('scores a chunk with zero sentences without NaN', () => {
    const chunk = scoreChunk(raw(['']), en);
    expect(Number.isFinite(chunk.score)).toBe(true);
    expect(chunk.spoDensity).toBe(0);
    expect(chunk.triples).toBe(0);
  });
});

describe('GEM-63-T04 Answer-First', () => {
  it('rewards a declarative lead under a question heading and penalises a question lead', () => {
    const answered = answerFirstScore(raw(['A CGM sensor lasts 10 to 14 days before it must be replaced.'], 'How long does a CGM sensor last?'), en);
    const questioned = answerFirstScore(raw(['How long does a CGM sensor last before replacement is needed?'], 'How long does a CGM sensor last?'), en);
    expect(answered).toBeGreaterThan(questioned);
  });

  it('ignores an answer that only appears after the first 60 words', () => {
    const padding = Array.from({ length: 65 }, () => 'word').join(' ');
    const late = answerFirstScore(raw([`${padding}. A CGM sensor lasts 14 days.`], 'How long does a CGM sensor last?'), en);
    const early = answerFirstScore(raw([`A CGM sensor lasts 14 days. ${padding}.`], 'How long does a CGM sensor last?'), en);
    expect(late).toBeLessThan(early);
  });

  it('penalises a filler opening and leaves later windows not applicable', () => {
    const filler = scoreChunk(raw(['In this article we will look at how a CGM sensor lasts 14 days.']), en);
    expect(filler.issues).toContain('filler-opening');
    expect(scoreChunk(raw(['A CGM sensor lasts 14 days.'], 'CGM sensor', 1), en).answerFirstAvailability).toBe('not-applicable');
  });
});

describe('GEM-63-T05 structure, languages, empty corpus and AEO regression', () => {
  it('counts tables with headers and concise lists, not bare tags', () => {
    expect(extractabilityOf([section('H', ['x'], { tables: 1, table_headers: 1 })])).toBeGreaterThan(extractabilityOf([section('H', ['x'], { tables: 1, table_headers: 0 })]));
    expect(extractabilityOf([section('H', ['x'], { unordered_lists: 1, list_item_word_counts: [5, 6] })])).toBeGreaterThan(extractabilityOf([section('H', ['x'], { unordered_lists: 1, list_item_word_counts: [40] })]));
  });

  it('marks unsupported languages and returns an unavailable report for an empty corpus', () => {
    expect(scorePageAio(aioPage('https://a.test/xx', [section('H', ['Sensor lasts 10 days.'])], { semantic_language: 'xx' })).languageStatus).toBe('unsupported');
    const empty = buildAioReport([]);
    expect(empty).toMatchObject({ availability: 'unavailable', scoredCount: 0, pageCount: 0 });
    expect(Number.isFinite(empty.score)).toBe(true);
    expect(buildAioReport([aioPage('https://a.test/none', undefined)]).availability).toBe('unavailable');
    expect(buildAioReport([GOOD_PAGE]).availability).not.toBe('unavailable');
  });

  it('leaves the historical brief AEO profile independent of AIO-R', () => {
    const markdown = '# CGM sensor\n\nA CGM sensor is a device that reads glucose every 5 minutes.\n\n## How long does it last?\n\nA CGM sensor lasts 14 days.';
    const first = assessAeoReadiness(markdown, undefined);
    buildAioReport([GOOD_PAGE]);
    expect(assessAeoReadiness(markdown, undefined)).toEqual(first);
    expect(first.score).toEqual(expect.any(Number));
  });
});
