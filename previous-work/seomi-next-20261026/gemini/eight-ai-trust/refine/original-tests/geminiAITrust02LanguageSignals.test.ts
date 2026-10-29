import { describe, expect, it } from 'vitest';
import {
  buildAioReport,
  countDangling,
  rulesFor,
  scorePageAio,
} from '@/services/aioReadiness';
import { aioPage, section } from './aioFixtures';

const en = rulesFor('en').rules;

describe('Antecedent vs dangling pronouns', () => {
  const heading = 'CGM sensor lifespan';

  it('does not count pronoun opener as dangling when heading entity is present', () => {
    const paragraphs = ['This sensor lasts up to 14 days without recalibration.'];
    expect(countDangling(paragraphs, heading, en)).toBe(0);
  });

  it('counts pronoun opener as dangling when heading entity is omitted from first sentence', () => {
    const paragraphs = ['This lasts up to 14 days without recalibration.'];
    expect(countDangling(paragraphs, heading, en)).toBe(1);
  });

  it('recognizes regular prefix-inflected stems as valid antecedents', () => {
    const pluralHeading = 'Glucose sensors';
    const paragraphs = ['These sensor units require calibration.'];
    expect(countDangling(paragraphs, pluralHeading, en)).toBe(0);
  });

  it('fails to resolve y-to-ies inflected stem causing false dangling count (RED product gap)', () => {
    const pluralHeading = 'Replacement batteries';
    const paragraphs = ['These battery units require careful recycling.'];
    expect(countDangling(paragraphs, pluralHeading, en)).toBe(0);
  });

  it('flags dangling pronoun when antecedent only appears in a later sentence', () => {
    const paragraphs = ['It requires special handling. The CGM sensor must stay clean.'];
    expect(countDangling(paragraphs, heading, en)).toBe(1);
  });

  it('flags dangling pronoun when heading is empty', () => {
    const paragraphs = ['This device operates at standard room temperature.'];
    expect(countDangling(paragraphs, '', en)).toBe(1);
  });

  it('handles empty paragraphs or whitespace without flagging dangling', () => {
    expect(countDangling([], heading, en)).toBe(0);
    expect(countDangling(['', '   \t  '], heading, en)).toBe(0);
  });
});

describe('Unsupported and unknown language signals', () => {
  it('falls back to basic coverage with extracted subtag for unsupported languages', () => {
    const nl = rulesFor('nl');
    expect(nl.language).toBe('nl');
    expect(nl.rules.coverage).toBe('basic');
    expect(nl.rules.relations).toBeDefined();

    const uk = rulesFor('uk-UA');
    expect(uk.language).toBe('uk');
    expect(uk.rules.coverage).toBe('basic');

    const empty = rulesFor('');
    expect(empty.language).toBe('en');
    expect(empty.rules.coverage).toBe('basic');
  });

  it('does not force score to zero for pages in unsupported languages with valid content', () => {
    const dutchSec = section('CGM Sensor Werking', [
      'The sensor lasts 14 days and measures glucose accurately.',
      'Daily monitoring requires no manual fingersticks.',
    ], { tables: 1, ordered_lists: 1 });
    const page = aioPage('https://a.test/nl-page', [dutchSec], { semantic_language: 'nl' });
    const report = scorePageAio(page);

    expect(report.language).toBe('nl');
    expect(report.coverage).toBe('basic');
    expect(report.score).toBeGreaterThan(0);
    expect(report.skipped).toBeUndefined();
  });

  it('falls back to basic English coverage when both semantic and document language are missing', () => {
    const sec = section('Sensor Guide', ['The sensor lasts 10 days.'], { tables: 1 });
    const page = aioPage('https://a.test/no-lang', [sec], {
      semantic_language: null,
      document_language: null,
    });
    const report = scorePageAio(page);

    expect(report.language).toBe('en');
    expect(report.coverage).toBe('basic');
    expect(report.score).toBeGreaterThan(0);
  });

  it('aggregates unsupported languages into basicRuleLanguages without zeroing skipped pages in site report', () => {
    const sec = section('Sensor Info', ['The sensor lasts 14 days.'], { tables: 1 });
    const scoredPage = aioPage('https://a.test/sv', [sec], { semantic_language: 'sv' });
    const skippedPage = aioPage('https://a.test/empty', undefined);

    const siteReport = buildAioReport([scoredPage, skippedPage]);

    expect(siteReport.basicRuleLanguages).toContain('sv');
    expect(siteReport.scoredCount).toBe(1);
    expect(siteReport.skippedCount).toBe(1);
    // Site mean reflects only scored pages; skipped page is not counted as zero in denominator
    expect(siteReport.score).toBe(scorePageAio(scoredPage).score);
    expect(siteReport.score).toBeGreaterThan(0);
  });
});
