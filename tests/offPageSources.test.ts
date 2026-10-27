import { describe, expect, it } from 'vitest';
import { brandAliases, selectSources, sourceDomain, usableVector } from '@/services/offPage/sources';
import { sourceParagraphs } from '@/services/offPage/sourceParagraphs';
import { buildOffPageReports } from '@/components/Domain/backlinkChecker/useOffPageReports';
import { computeTbva } from '@/services/offPage/tbva';
import { sourceAnalysis, sourceEvidence, sourceLink, sourceProfile, sourceVector } from './fixtures/offPageSources';

describe('source selection, text blocks and evidence reports', () => {
  it('selects at most 25 follow domains by finite authority without mutating the profile', () => {
    const profile = sourceProfile([sourceLink('https://www.source.test/low', 5), sourceLink('https://blog.source.test/best', 99),
      sourceLink('https://ignored.test', 100, false), sourceLink('https://unknown.test', NaN),
      ...Array.from({ length: 30 }, (_, index) => sourceLink(`https://source${index}.test`, index))]);
    const snapshot = JSON.stringify(profile);
    const sources = selectSources(profile);
    expect(sources).toHaveLength(25);
    expect(sources[0]).toMatchObject({ sourceUrl: 'https://blog.source.test/best', authority: 99, text: '', fetchedAt: null });
    expect(sources.at(-1)?.authority).toBe(6);
    expect(JSON.stringify(profile)).toBe(snapshot);
    expect(selectSources(sourceProfile([sourceLink('https://nan.test', NaN), sourceLink('https://finite.test', 0)]))
      .map((source) => source.authority)).toEqual([0, null]);
  });
  it('normalizes domains and derives aliases without manufacturing a topic', () => {
    expect(sourceDomain('https://WWW.example.co.uk/page')).toBe('example.co.uk');
    expect(sourceDomain('localhost')).toBe('localhost');
    expect(sourceDomain('bad url')).toBe('bad url');
    expect(brandAliases('acme.test', ' Acme ')).toEqual(['Acme', 'acme.test', 'acme']);
    expect(brandAliases('', ' ')).toEqual([]);
    expect(buildOffPageReports(null).tbva.limitations).toEqual(['no-topic-vector']);
    expect(buildOffPageReports(sourceProfile()).coCitation.note).toBe('no-source-text');
  });
  it('retains exact offsets in inferred bounded text blocks and never infers linked context', () => {
    const text = '  Acme SEO.  \n\n' + 'word '.repeat(450) + '\n' + 'x'.repeat(2100) + '\n   ';
    const blocks = sourceParagraphs([sourceEvidence({ availability: 'ok', text }), sourceEvidence({ text: 'ignore' })]);
    expect(blocks.length).toBeGreaterThan(5);
    expect(blocks[0]).toMatchObject({ offset: 2, text: 'Acme SEO.', linked: false });
    blocks.forEach((block) => {
      expect(block.text.length).toBeLessThanOrEqual(1000);
      expect(text.slice(block.offset, block.offset + block.text.length)).toBe(block.text);
      expect(block.linked).toBe(false);
    });
  });
  it('feeds real vectors, authority, aliases and source paragraphs into both reports', () => {
    const evidence = sourceAnalysis([sourceEvidence({ availability: 'ok', text: 'Acme not SEO', vector: sourceVector(1, 0) }),
      sourceEvidence({ sourceUrl: 'https://other.test', authority: null })]);
    const reports = buildOffPageReports(sourceProfile(), { ...evidence, topic: sourceVector(1, 0) });
    expect(reports.tbva).toMatchObject({ status: 'partial', counted: 1, unscored: 1, tbva: 0.8 });
    expect(reports.coCitation.unlinked[0]).toMatchObject({ sourceUrl: 'https://source.test/page', offset: 0, polarity: 'unclear' });
  });
  it.each([null, undefined, [], [0, 0], [NaN], [Infinity]].map((vector) => ({ vector })))('rejects unusable vector $vector', ({ vector }) => {
    expect(usableVector(vector ? Float64Array.from(vector) : vector)).toBe(false);
  });
  it('never treats zero, nonfinite or mismatched vectors and authority as scored evidence', () => {
    expect(usableVector(sourceVector(1, 0))).toBe(true);
    for (const vector of [[0, 0], [NaN, 1], [1]]) {
      const report = computeTbva([{ sourceUrl: 'x', vector: Float64Array.from(vector), authority: 50, follow: true }], { scale: 100, topic: sourceVector(1, 0) });
      expect(report).toMatchObject({ status: 'unavailable', unscored: 1, tbva: null });
    }
    expect(computeTbva([], { scale: 100, topic: sourceVector(0) }).limitations).toEqual(['no-topic-vector']);
    expect(computeTbva([], { scale: Infinity, topic: sourceVector(1) }).limitations).toEqual(['invalid-scale']);
    expect(computeTbva([{ sourceUrl: 'x', vector: sourceVector(1), authority: NaN, follow: true }], { scale: 100, topic: sourceVector(1) }).unscored).toBe(1);
  });
});
