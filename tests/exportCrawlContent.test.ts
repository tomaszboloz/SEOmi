import { describe, expect, it } from 'vitest';
import { crawlPagesCsv } from '@/services/export';
import { CrawlRunRecord } from '@/types';
import { crawlRun } from './fixtures/export';

describe('export contracts: content', () => {
  it('exports deterministic per-page content metrics', () => {
      const run = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            sentence_count: 4,
            average_words_per_sentence: 12.5,
            average_characters_per_word: 5.1,
            complexity_score: 83,
            complexity_label: 'simple',
            readability_ease_score: 72.4,
            readability_grade: 6.8,
            readability_label: 'standard',
            content_terms: [{ term: 'espresso', count: 4, density_percent: 12.5 }],
            focus_phrase: { phrase: 'espresso guide', body_occurrences: 2, body_density_percent: 8.3, title_occurrences: 1, meta_description_occurrences: 1, h1_occurrences: 1 },
          })),
        },
      } as CrawlRunRecord;
  
      const output = crawlPagesCsv(run);
      expect(output).toContain('Sentence count');
      expect(output).toContain('Average words per sentence');
      expect(output).toContain('83');
      expect(output).toContain('simple');
      expect(output).toContain('Readability ease score');
      expect(output).toContain('72.4');
      expect(output).toContain('standard');
      expect(output).toContain('Top content terms (term/count/density)');
      expect(output).toContain('espresso/4/12.50%');
      expect(output).toContain('Focus phrase evidence');
      expect(output).toContain('espresso guide; body=2');
    });

  it('exports duplicate heading text, levels, and occurrence counts', () => {
      const duplicateHeadingRun = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            duplicate_headings: [{ text: 'Quick start', levels: [2, 3], occurrences: 2 }],
          })),
        },
      } as CrawlRunRecord;
  
      const output = crawlPagesCsv(duplicateHeadingRun);
      expect(output).toContain('Duplicate headings (text/levels/count)');
      expect(output).toContain('H2/H3: Quick start (2)');
    });
});
