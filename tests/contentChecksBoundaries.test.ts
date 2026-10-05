import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { buildContentChecks } from '@/services/auditChecks/accessibilityAndContentChecks';
import type { PageAuditData } from '@/types';

const base = { word_count: 500, reading_time_minutes: 3, text_ratio_percent: 20, top_keywords: [], body_text: 'text' };
const run = (content: Record<string, unknown> = {}) => buildContentChecks({ content_stats: { ...base, ...content } } as unknown as PageAuditData);
const status = (content: Record<string, unknown>, id: string) => run(content).find((c) => c.id === id)?.status;
const optional = { sentence_count: 10, average_words_per_sentence: 12, average_characters_per_word: 5, complexity_score: 30, readability_ease_score: 70, readability_grade: 8 };

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('content checks', () => {
  it('passes a healthy page and treats legacy metrics as not applicable', () => {
    expect(new Set(run(optional).map((c) => c.status))).toEqual(new Set(['pass']));
    const legacy = Object.fromEntries(run({ body_text: undefined }).map((c) => [c.id, c.status]));
    for (const id of ['content-sentence-count', 'content-average-sentence', 'content-average-word', 'content-complexity', 'content-readability', 'content-readability-grade', 'content-truncation']) expect(legacy[id]).toBe('not_applicable');
  });

  it.each([[0, 'warning'], [1, 'pass'], [NaN, 'error']])('rates word count %s as %s', (word_count, expected) => {
    expect(status({ word_count }, 'content-word-count')).toBe(expected);
  });

  it.each([[0, 'warning'], [0.1, 'pass'], [Infinity, 'error']])('rates text ratio %s as %s', (text_ratio_percent, expected) => {
    expect(status({ text_ratio_percent }, 'content-text-ratio')).toBe(expected);
  });

  it('errors on a non-finite reading time', () => {
    expect(status({ reading_time_minutes: NaN }, 'content-reading-time')).toBe('error');
  });

  it.each([
    ['sentence_count', 0, 'content-sentence-count', 'warning'],
    ['average_words_per_sentence', 31, 'content-average-sentence', 'warning'],
    ['average_words_per_sentence', 30, 'content-average-sentence', 'pass'],
    ['average_characters_per_word', 12.1, 'content-average-word', 'warning'],
    ['complexity_score', 71, 'content-complexity', 'warning'],
    ['complexity_score', 70, 'content-complexity', 'pass'],
    ['readability_ease_score', 49, 'content-readability', 'warning'],
    ['readability_ease_score', 50, 'content-readability', 'pass'],
    ['readability_grade', 13, 'content-readability-grade', 'warning'],
    ['readability_grade', 12, 'content-readability-grade', 'pass'],
  ])('rates %s=%s as %s on %s', (field, value, id, expected) => {
    expect(status({ ...optional, [field]: value }, id)).toBe(expected);
  });

  it('warns when summed top-keyword density exceeds 25%', () => {
    expect(status({ top_keywords: [{ density_percent: 20 }, { density_percent: 5 }] }, 'content-keyword-density')).toBe('pass');
    expect(status({ top_keywords: [{ density_percent: 20 }, { density_percent: 5.1 }, {}] }, 'content-keyword-density')).toBe('warning');
  });

  it('reports truncation before body presence', () => {
    expect(status({ body_text_truncated: true }, 'content-truncation')).toBe('warning');
    expect(status({ body_text_truncated: false }, 'content-truncation')).toBe('pass');
  });
});
